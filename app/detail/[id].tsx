import { useState, useCallback } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, Image, Alert, Platform } from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius, FontSize } from '../../src/constants/theme';
import { useMomentDetail } from '../../src/hooks/useMoments';
import { PRESET_TAGS, getEmotionDef } from '../../src/types';
import { updateCaption, updateTags, toggleFavorite, deleteMoment, addAppendNote } from '../../src/db/momentsRepo';
import { deletePhotoFile } from '../../src/services/fileStorage';

export default function MomentDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { moment, notes, refresh } = useMomentDetail(id ?? null);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [newNote, setNewNote] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [showTagEditor, setShowTagEditor] = useState(false);

  const emoDef = getEmotionDef(moment?.emotion ?? null);

  const handleEdit = useCallback(() => { setEditText(moment?.caption ?? ''); setEditing(true); }, [moment?.caption]);
  const handleSaveEdit = useCallback(async () => {
    if (!id) return;
    try {
      await updateCaption(id, editText);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEditing(false); refresh();
    } catch (e) { console.error('[detail] saveEdit error:', e); }
  }, [id, editText, refresh]);
  const handleToggleFavorite = useCallback(async () => {
    if (!id) return; await toggleFavorite(id);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); refresh();
  }, [id, refresh]);
  const handleToggleTag = useCallback(async (tag: string) => {
    if (!moment) return;
    const newTags = moment.tags.includes(tag) ? moment.tags.filter(t => t !== tag) : [...moment.tags, tag];
    await updateTags(moment.id, newTags); refresh();
  }, [moment, refresh]);
  const handleDelete = useCallback(() => {
    if (!moment) return;
    const doDelete = async () => {
      await deleteMoment(moment.id);
      await deletePhotoFile(moment.photoUri);
      router.back();
    };
    // Web uses browser native confirm dialog
    if (Platform.OS === 'web') {
      if (window.confirm('删除这个瞬间？照片和所有文字将被永久删除')) doDelete();
      return;
    }
    // Native uses Alert with custom buttons
    Alert.alert('删除这个瞬间？', '照片和所有文字将被永久删除', [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: doDelete },
    ]);
  }, [moment, router]);
  const handleAddNote = useCallback(async () => {
    if (!id || !newNote.trim()) return;
    try {
      await addAppendNote(id, newNote.trim());
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setNewNote(''); setShowNoteInput(false); refresh();
    } catch (e) { console.error('[detail] addNote error:', e); }
  }, [id, newNote, refresh]);

  if (!moment) {
    return (
      <View style={styles.loading}><Stack.Screen options={{ headerShown: false }} /><Text style={styles.loadingText}>加载中...</Text></View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{
        headerShown: true, title: '瞬间', headerStyle: { backgroundColor: Colors.bg },
        headerTintColor: Colors.text, headerTitleStyle: { fontWeight: '600', color: Colors.text }, headerShadowVisible: false,
        headerRight: () => (
          <TouchableOpacity onPress={handleToggleFavorite} style={{ marginRight: Spacing.md }}>
            <Text style={{ fontSize: 22 }}>{moment.isFavorite ? '⭐' : '☆'}</Text>
          </TouchableOpacity>
        ),
      }} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="always">
        <Image source={{ uri: moment.photoUri }} style={styles.photo} resizeMode="contain" />

        <View style={styles.metaRow}>
          <View style={styles.metaLeft}>
            {emoDef && (
              <View style={[styles.emotionBadge, { backgroundColor: emoDef.color + '20' }]}>
                <Text style={styles.emotionEmoji}>{emoDef.emoji}</Text>
                <Text style={[styles.emotionText, { color: emoDef.color }]}>{emoDef.label}</Text>
              </View>
            )}
            {moment.emotionReason ? <Text style={styles.emotionReason}>"{moment.emotionReason}"</Text> : null}
          </View>
          <Text style={styles.timestamp}>
            {new Date(moment.createdAt).toLocaleString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>

        {editing ? (
          <View style={styles.editWrap}>
            <TextInput style={styles.editInput} value={editText} onChangeText={setEditText} multiline autoFocus />
            <View style={styles.editActions}>
              <TouchableOpacity onPress={() => setEditing(false)}><Text style={styles.editCancel}>取消</Text></TouchableOpacity>
              <TouchableOpacity onPress={handleSaveEdit}><Text style={styles.editSave}>保存</Text></TouchableOpacity>
            </View>
          </View>
        ) : moment.caption ? (
          <View style={styles.captionWrap}>
            <Text style={styles.caption}>{moment.caption}</Text>
            <TouchableOpacity onPress={handleEdit}><Text style={styles.editHint}>编辑</Text></TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.addCaptionBtn} onPress={handleEdit}><Text style={styles.addCaptionText}>+ 添加文字</Text></TouchableOpacity>
        )}

        <View style={styles.tagsSection}>
          <View style={styles.tagsHeader}>
            <Text style={styles.tagsSectionTitle}>🏷️ 标签</Text>
            <TouchableOpacity onPress={() => setShowTagEditor(!showTagEditor)}><Text style={styles.editHint}>{showTagEditor ? '收起' : '编辑'}</Text></TouchableOpacity>
          </View>
          {showTagEditor ? (
            <View style={styles.tagEditRow}>
              {PRESET_TAGS.map(tag => (
                <TouchableOpacity key={tag} style={[styles.tagBtn, moment.tags.includes(tag) && styles.tagBtnSelected]} onPress={() => handleToggleTag(tag)}>
                  <Text style={[styles.tagText, moment.tags.includes(tag) && styles.tagTextSelected]}>{tag}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.tagRow}>
              {moment.tags.length > 0 ? moment.tags.map(tag => (
                <View key={tag} style={styles.tagChip}><Text style={styles.tagChipText}>{tag}</Text></View>
              )) : <Text style={styles.noTags}>暂无标签</Text>}
            </View>
          )}
        </View>

        {notes.length > 0 && (
          <View style={styles.notesSection}>
            <Text style={styles.notesSectionTitle}>💭 后来的想法</Text>
            {notes.map(note => (
              <View key={note.id} style={styles.noteCard}>
                <Text style={styles.noteText}>{note.text}</Text>
                <Text style={styles.noteTime}>{new Date(note.createdAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</Text>
              </View>
            ))}
          </View>
        )}

        {showNoteInput ? (
          <View style={styles.noteInputWrap}>
            <TextInput style={styles.noteInput} value={newNote} onChangeText={setNewNote} placeholder="写下后来的想法..." placeholderTextColor={Colors.textSecondary} multiline autoFocus />
            <View style={styles.noteInputActions}>
              <TouchableOpacity onPress={() => { setShowNoteInput(false); setNewNote(''); }}><Text style={styles.editCancel}>取消</Text></TouchableOpacity>
              <TouchableOpacity onPress={handleAddNote} disabled={!newNote.trim()}><Text style={[styles.editSave, !newNote.trim() && { opacity: 0.4 }]}>添加</Text></TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={styles.addNoteBtn} onPress={() => setShowNoteInput(true)}><Text style={styles.addNoteText}>+ 添加心得</Text></TouchableOpacity>
        )}

        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}><Text style={styles.deleteText}>删除此瞬间</Text></TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.lg, paddingBottom: 40 },
  photo: { width: '100%', aspectRatio: 4 / 5, borderRadius: Radius.xl, backgroundColor: Colors.dark },
  metaRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingVertical: Spacing.md },
  metaLeft: { flex: 1, marginRight: Spacing.md },
  emotionBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full, gap: 6 },
  emotionEmoji: { fontSize: 18 },
  emotionText: { fontSize: FontSize.sm, fontWeight: '600' },
  emotionReason: { fontSize: FontSize.sm, color: Colors.textSecondary, fontStyle: 'italic', marginTop: 4 },
  timestamp: { fontSize: FontSize.xs, color: Colors.textSecondary },
  captionWrap: { marginBottom: Spacing.md },
  caption: { fontSize: FontSize.md, color: Colors.text, lineHeight: 24 },
  editHint: { fontSize: FontSize.xs, color: Colors.primary, marginTop: Spacing.xs },
  editWrap: { marginBottom: Spacing.md },
  editInput: { backgroundColor: Colors.white, borderRadius: Radius.md, padding: Spacing.md, minHeight: 100, fontSize: FontSize.md, color: Colors.text, lineHeight: 24, borderWidth: 1, borderColor: Colors.border },
  editActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.md, marginTop: Spacing.sm },
  editCancel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  editSave: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600' },
  addCaptionBtn: { paddingVertical: Spacing.md },
  addCaptionText: { fontSize: FontSize.md, color: Colors.textSecondary },
  tagsSection: { marginTop: Spacing.lg, marginBottom: Spacing.md },
  tagsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tagsSectionTitle: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.sm },
  tagChip: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: Radius.full, backgroundColor: Colors.secondary },
  tagChipText: { fontSize: FontSize.xs, color: Colors.text },
  noTags: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: Spacing.xs },
  tagEditRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.sm },
  tagBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: Radius.full, backgroundColor: Colors.secondary },
  tagBtnSelected: { backgroundColor: Colors.primary },
  tagText: { fontSize: FontSize.xs, color: Colors.textSecondary },
  tagTextSelected: { color: Colors.white, fontWeight: '600' },
  notesSection: { marginTop: Spacing.xl },
  notesSectionTitle: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600', marginBottom: Spacing.sm },
  noteCard: { backgroundColor: Colors.accentLight, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.sm, borderLeftWidth: 3, borderLeftColor: Colors.accent },
  noteText: { fontSize: FontSize.sm, color: '#6B5F58', lineHeight: 20 },
  noteTime: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: Spacing.xs },
  noteInputWrap: { marginTop: Spacing.md },
  noteInput: { backgroundColor: Colors.white, borderRadius: Radius.md, padding: Spacing.md, minHeight: 80, fontSize: FontSize.sm, color: Colors.text, lineHeight: 20, borderWidth: 1, borderColor: Colors.border },
  noteInputActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.lg, marginTop: Spacing.sm },
  addNoteBtn: { marginTop: Spacing.md, alignSelf: 'center', paddingVertical: Spacing.sm },
  addNoteText: { fontSize: FontSize.sm, color: Colors.primary },
  deleteBtn: { marginTop: Spacing.xxxl, alignSelf: 'center', paddingVertical: Spacing.md },
  deleteText: { fontSize: FontSize.sm, color: Colors.danger },
  loading: { flex: 1, backgroundColor: Colors.bg, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: FontSize.md, color: Colors.textSecondary },
});
