import { useState, useCallback } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Image, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius, FontSize } from '../src/constants/theme';
import { EMOTIONS, PRESET_TAGS, type EmotionKey } from '../src/types';
import { createMoment } from '../src/db/momentsRepo';
import { moveToPermanent, deletePhotoFile } from '../src/services/fileStorage';

export default function CaptionScreen() {
  const router = useRouter();
  const { photoUri } = useLocalSearchParams<{ photoUri: string }>();
  const [caption, setCaption] = useState('');
  const [emotion, setEmotion] = useState<EmotionKey | null>(null);
  const [emotionReason, setEmotionReason] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  }, []);

  const handleSave = useCallback(async () => {
    if (saving || !photoUri) return;
    setSaving(true);
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const momentId = 'm_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
      const permanentUri = await moveToPermanent(photoUri, momentId);
      await createMoment(permanentUri, caption.trim(), emotion, emotionReason.trim(), selectedTags);
      router.replace('/(tabs)');
    } catch (err) {
      console.error('[caption] handleSave error:', err);
      Alert.alert('保存失败', '请重试');
    } finally { setSaving(false); }
  }, [saving, photoUri, caption, emotion, emotionReason, selectedTags, router]);

  const handleDiscard = useCallback(() => {
    const doDiscard = async () => { if (photoUri) await deletePhotoFile(photoUri); router.back(); };
    if (Platform.OS === 'web') {
      if (window.confirm('舍弃这张照片？照片将被删除且无法恢复')) doDiscard();
      return;
    }
    Alert.alert('舍弃这张照片？', '照片将被删除且无法恢复', [
      { text: '取消', style: 'cancel' },
      { text: '舍弃', style: 'destructive', onPress: doDiscard },
    ]);
  }, [photoUri, router]);

  if (!photoUri) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>无法加载照片</Text>
        <TouchableOpacity onPress={() => router.back()}><Text style={styles.backLink}>返回</Text></TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="always" showsVerticalScrollIndicator={false}>
        <View style={styles.photoWrap}>
          <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="contain" />
          <View style={styles.watermark}>
            <Text style={styles.watermarkText}>
              {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })}{' '}
              {new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        </View>

        <View style={styles.emotionRow}>
          {EMOTIONS.map(e => (
            <TouchableOpacity
              key={e.key} style={[styles.emojiBtn, emotion === e.key && styles.emojiBtnSelected]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setEmotion(prev => (prev === e.key ? null : e.key)); }}
            >
              <Text style={styles.emojiText}>{e.emoji}</Text>
              <Text style={styles.emojiLabel}>{e.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {emotion && (
          <TextInput style={styles.reasonInput} value={emotionReason} onChangeText={setEmotionReason}
            placeholder={`为什么感到${EMOTIONS.find(e => e.key === emotion)?.label}？`}
            placeholderTextColor={Colors.textSecondary} maxLength={200}
          />
        )}

        <View style={styles.captionWrap}>
          <TextInput style={styles.captionInput} value={caption} onChangeText={setCaption}
            placeholder="想写点什么吗？（可选）" placeholderTextColor={Colors.textSecondary}
            multiline textAlignVertical="top" maxLength={5000}
          />
        </View>

        <View style={styles.tagRow}>
          {PRESET_TAGS.map(tag => (
            <TouchableOpacity key={tag} style={[styles.tagBtn, selectedTags.includes(tag) && styles.tagBtnSelected]} onPress={() => toggleTag(tag)}>
              <Text style={[styles.tagText, selectedTags.includes(tag) && styles.tagTextSelected]}>{tag}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={[styles.submitBtn, saving && { opacity: 0.5 }]} onPress={handleSave} disabled={saving} activeOpacity={0.8}>
          <Text style={styles.submitText}>💾 保存瞬间</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.discardBtn} onPress={handleDiscard}>
          <Text style={styles.discardText}>舍弃此照片</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.lg, paddingBottom: 40 },
  photoWrap: { marginTop: 60, borderRadius: Radius.xl, overflow: 'hidden', position: 'relative' },
  photo: { width: '100%', aspectRatio: 4 / 5, backgroundColor: Colors.dark, borderRadius: Radius.xl },
  watermark: { position: 'absolute', bottom: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.3)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.sm },
  watermarkText: { color: 'rgba(255,255,255,0.85)', fontSize: FontSize.xs, fontWeight: '500' },
  emotionRow: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.xl, flexWrap: 'wrap' },
  emojiBtn: {
    alignItems: 'center', gap: 2, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm,
    borderRadius: Radius.lg, backgroundColor: Colors.emojiBg, minWidth: 52,
  },
  emojiBtnSelected: { backgroundColor: Colors.emojiSelected, transform: [{ scale: 1.1 }] },
  emojiText: { fontSize: 22 },
  emojiLabel: { fontSize: 10, color: Colors.textSecondary },
  reasonInput: { backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.md, fontSize: FontSize.sm, color: Colors.text, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.sm },
  captionWrap: { marginBottom: Spacing.xl },
  captionInput: { backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.lg, minHeight: 120, fontSize: FontSize.md, color: Colors.text, lineHeight: 24, borderWidth: 1, borderColor: Colors.border },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.xl },
  tagBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: Radius.full, backgroundColor: Colors.secondary },
  tagBtnSelected: { backgroundColor: Colors.primary },
  tagText: { fontSize: FontSize.xs, color: Colors.textSecondary },
  tagTextSelected: { color: Colors.white, fontWeight: '600' },
  submitBtn: { height: 52, backgroundColor: Colors.primary, borderRadius: Radius.lg, justifyContent: 'center', alignItems: 'center', shadowColor: Colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 4 },
  submitText: { color: Colors.white, fontSize: 17, fontWeight: '600' },
  discardBtn: { marginTop: Spacing.lg, alignSelf: 'center', paddingVertical: Spacing.sm },
  discardText: { color: Colors.danger, fontSize: FontSize.sm },
  emptyContainer: { flex: 1, backgroundColor: Colors.bg, justifyContent: 'center', alignItems: 'center', gap: Spacing.md },
  emptyText: { fontSize: FontSize.lg, color: Colors.textSecondary },
  backLink: { fontSize: FontSize.md, color: Colors.primary },
});
