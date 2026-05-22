import { useState, useCallback } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, Image, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Paths, File, Directory } from 'expo-file-system';
import { Colors, Spacing, Radius, FontSize } from '../../src/constants/theme';
import { EMOTIONS, PRESET_TAGS, type EmotionKey } from '../../src/types';
import { createMoment } from '../../src/db/momentsRepo';
import { savePhotoFromPicker } from '../../src/services/fileStorage';

const BG_OPTIONS = [
  { label: '无', color: Colors.white },
  { label: '暖橘', color: '#FDF0E8' },
  { label: '天蓝', color: '#E8F2FD' },
  { label: '雾绿', color: '#EAF5EB' },
  { label: '暮紫', color: '#F2EBF5' },
  { label: '深灰', color: '#2D2A28' },
];

export default function WriteScreen() {
  const router = useRouter();
  const [text, setText] = useState('');
  const [emotion, setEmotion] = useState<EmotionKey | null>(null);
  const [emotionReason, setEmotionReason] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [bgColor, setBgColor] = useState(BG_OPTIONS[0].color);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const pickImages = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 9, quality: 0.85,
    });
    if (!result.canceled && result.assets.length > 0) {
      setImages(prev => { const combined = [...prev, ...result.assets.map(a => a.uri)]; return combined.slice(0, 9); });
    }
  }, []);

  const removeImage = useCallback((idx: number) => { setImages(prev => prev.filter((_, i) => i !== idx)); }, []);

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  }, []);

  const handleSave = useCallback(async () => {
    if (saving) return;
    if (!text.trim() && images.length === 0) { Alert.alert('提示', '至少写点文字或添加图片吧'); return; }
    setSaving(true);
    try {
      const momentId = 'm_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
      if (images.length > 0) {
        const permanentUri = await savePhotoFromPicker(images[0], momentId);
        await createMoment(permanentUri, text.trim(), emotion, emotionReason.trim(), selectedTags);
      } else {
        let cardUri = '';
        try {
          const textCardDir = new Directory(Paths.document, 'text_cards');
          textCardDir.create({ intermediates: true });
          const cardFile = new File(textCardDir, momentId + '.json');
          cardFile.create({ overwrite: true });
          cardFile.write(JSON.stringify({ bgColor, text: text.trim() }));
          cardUri = cardFile.uri;
        } catch {
          cardUri = 'data:text/json,' + encodeURIComponent(JSON.stringify({ bgColor, text: text.trim() }));
        }
        await createMoment(cardUri, text.trim(), emotion, emotionReason.trim(), selectedTags);
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setText(''); setEmotion(null); setEmotionReason(''); setImages([]); setSelectedTags([]);
      router.replace('/(tabs)');
    } catch (err) {
      console.error('[write] handleSave error:', err);
      Alert.alert('保存失败', '请重试');
    } finally { setSaving(false); }
  }, [saving, text, emotion, emotionReason, images, bgColor, selectedTags, router]);

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="always" showsVerticalScrollIndicator={false}>
        <View style={[styles.textArea, { backgroundColor: bgColor }]}>
          <TextInput
            style={[styles.textInput, { color: bgColor === '#2D2A28' ? '#E8DDD4' : Colors.text }]}
            value={text} onChangeText={setText}
            placeholder="今天想写点什么？"
            placeholderTextColor={bgColor === '#2D2A28' ? 'rgba(255,255,255,0.3)' : Colors.textSecondary}
            multiline textAlignVertical="top" maxLength={10000}
          />
          {text.length > 0 && <Text style={[styles.charCount, { color: bgColor === '#2D2A28' ? 'rgba(255,255,255,0.3)' : Colors.textSecondary }]}>{text.length}/10000</Text>}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bgRow}>
          {BG_OPTIONS.map(bg => (
            <TouchableOpacity key={bg.label} style={[styles.bgDot, { backgroundColor: bg.color }, bgColor === bg.color && styles.bgDotSelected]} onPress={() => setBgColor(bg.color)}>
              <Text style={[styles.bgDotLabel, { color: bg.color === '#2D2A28' ? '#fff' : Colors.text }]}>{bg.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {images.length > 0 && (
          <View style={styles.imageGrid}>
            {images.map((uri, idx) => (
              <View key={idx} style={styles.imageWrap}>
                <Image source={{ uri }} style={styles.gridImage} />
                <TouchableOpacity style={styles.removeImgBtn} onPress={() => removeImage(idx)}><Text style={styles.removeImgText}>✕</Text></TouchableOpacity>
              </View>
            ))}
            {images.length < 9 && (
              <TouchableOpacity style={styles.addGridBtn} onPress={pickImages}><Text style={styles.addGridText}>+</Text></TouchableOpacity>
            )}
          </View>
        )}
        {images.length === 0 && (
          <TouchableOpacity style={styles.addPhotoBtn} onPress={pickImages}>
            <Text style={styles.addPhotoText}>📷 添加配图（最多9张）</Text>
          </TouchableOpacity>
        )}

        <View style={styles.emotionRow}>
          {EMOTIONS.map(e => (
            <TouchableOpacity
              key={e.key} style={[styles.emojiBtn, emotion === e.key && styles.emojiBtnSelected]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setEmotion(prev => (prev === e.key ? null : e.key)); }}
            >
              <Text style={styles.emojiText}>{e.emoji}</Text>
              <Text style={[styles.emojiLabel, emotion === e.key && { color: e.color }]}>{e.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {emotion && (
          <TextInput
            style={styles.reasonInput}
            value={emotionReason} onChangeText={setEmotionReason}
            placeholder={`为什么感到${EMOTIONS.find(e => e.key === emotion)?.label}？`}
            placeholderTextColor={Colors.textSecondary} maxLength={200}
          />
        )}

        <View style={styles.tagRow}>
          {PRESET_TAGS.map(tag => (
            <TouchableOpacity key={tag} style={[styles.tagBtn, selectedTags.includes(tag) && styles.tagBtnSelected]} onPress={() => toggleTag(tag)}>
              <Text style={[styles.tagText, selectedTags.includes(tag) && styles.tagTextSelected]}>{tag}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.submitBtn} onPress={handleSave} disabled={saving} activeOpacity={0.8}>
          <Text style={styles.submitText}>💾 保存记录</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.lg, paddingBottom: 40 },
  textArea: { minHeight: 200, borderRadius: Radius.xl, padding: Spacing.xl, marginTop: 60 },
  textInput: { flex: 1, fontSize: FontSize.lg, lineHeight: 28, minHeight: 160 },
  charCount: { textAlign: 'right', fontSize: FontSize.xs, marginTop: Spacing.sm },
  bgRow: { marginTop: Spacing.md, maxHeight: 48 },
  bgDot: { width: 52, height: 36, borderRadius: Radius.md, marginRight: Spacing.sm, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
  bgDotSelected: { borderColor: Colors.primary },
  bgDotLabel: { fontSize: 10, fontWeight: '600' },
  imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.lg },
  imageWrap: { width: '30%', aspectRatio: 1, borderRadius: Radius.md, overflow: 'hidden' },
  gridImage: { width: '100%', height: '100%', borderRadius: Radius.md },
  removeImgBtn: { position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: Radius.full, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  removeImgText: { color: '#fff', fontSize: 12 },
  addGridBtn: { width: '30%', aspectRatio: 1, borderRadius: Radius.md, borderWidth: 2, borderColor: Colors.border, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
  addGridText: { fontSize: 28, color: Colors.textSecondary },
  addPhotoBtn: { marginTop: Spacing.lg, paddingVertical: Spacing.md, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed', alignItems: 'center' },
  addPhotoText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  emotionRow: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.xl, flexWrap: 'wrap' },
  emojiBtn: {
    alignItems: 'center', gap: 2, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm,
    borderRadius: Radius.lg, backgroundColor: Colors.emojiBg, minWidth: 52,
  },
  emojiBtnSelected: { backgroundColor: Colors.emojiSelected, transform: [{ scale: 1.1 }] },
  emojiText: { fontSize: 22 },
  emojiLabel: { fontSize: 10, color: Colors.textSecondary },
  reasonInput: {
    backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.md,
    fontSize: FontSize.sm, color: Colors.text, borderWidth: 1, borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, paddingBottom: Spacing.sm },
  tagBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: Radius.full, backgroundColor: Colors.secondary },
  tagBtnSelected: { backgroundColor: Colors.primary },
  tagText: { fontSize: FontSize.xs, color: Colors.textSecondary },
  tagTextSelected: { color: Colors.white, fontWeight: '600' },
  submitBtn: {
    height: 52, backgroundColor: Colors.primary, borderRadius: Radius.lg,
    justifyContent: 'center', alignItems: 'center', marginTop: Spacing.md,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 6, elevation: 4,
  },
  submitText: { color: Colors.white, fontSize: 17, fontWeight: '600' },
});
