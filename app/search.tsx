import { useState, useCallback } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, Image } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius, FontSize } from '../src/constants/theme';
import { searchMoments, getMomentsByDateRange } from '../src/db/momentsRepo';
import { getEmotionDef } from '../src/types';
import type { Moment } from '../src/types';

type SearchMode = 'text' | 'date';

export default function SearchScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<SearchMode>('text');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Moment[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const now = new Date();
  const [selYear, setSelYear] = useState(now.getFullYear());
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1);
  const [selDay, setSelDay] = useState(now.getDate());
  const daysInMonth = new Date(selYear, selMonth, 0).getDate();

  const handleTextSearch = useCallback(async () => {
    if (!query.trim()) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setResults(await searchMoments(query.trim()));
    setHasSearched(true);
  }, [query]);

  const handleDateSearch = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const start = new Date(selYear, selMonth - 1, selDay).getTime();
    setResults(await getMomentsByDateRange(start, start + 86400000));
    setHasSearched(true);
  }, [selYear, selMonth, selDay]);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: true, title: '搜索', headerStyle: { backgroundColor: Colors.bg }, headerTintColor: Colors.text, headerTitleStyle: { fontWeight: '300', color: Colors.text }, headerShadowVisible: false }} />

      <View style={styles.modeRow}>
        <TouchableOpacity style={[styles.modeBtn, mode === 'text' && styles.modeBtnActive]} onPress={() => { setMode('text'); setResults([]); setHasSearched(false); }}>
          <Text style={[styles.modeText, mode === 'text' && styles.modeTextActive]}>关键词</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.modeBtn, mode === 'date' && styles.modeBtnActive]} onPress={() => { setMode('date'); setResults([]); setHasSearched(false); }}>
          <Text style={[styles.modeText, mode === 'date' && styles.modeTextActive]}>按日期</Text>
        </TouchableOpacity>
      </View>

      {mode === 'text' && (
        <View style={styles.searchBar}>
          <TextInput style={styles.searchInput} value={query} onChangeText={setQuery} placeholder="搜索文字、情绪原因" placeholderTextColor={Colors.textSecondary} returnKeyType="search" onSubmitEditing={handleTextSearch} autoFocus />
          <TouchableOpacity style={styles.searchBtn} onPress={handleTextSearch}><Text style={styles.searchBtnText}>搜索</Text></TouchableOpacity>
        </View>
      )}

      {mode === 'date' && (
        <View style={styles.datePicker}>
          <View style={styles.dateRow}>
            {(['year', 'month', 'day'] as const).map(field => {
              const val = field === 'year' ? selYear : field === 'month' ? selMonth : selDay;
              const max = field === 'month' ? 12 : field === 'day' ? daysInMonth : 2099;
              const setFn = field === 'year' ? setSelYear : field === 'month' ? setSelMonth : setSelDay;
              return (
                <View key={field} style={styles.dateCol}>
                  <TouchableOpacity onPress={() => setFn((v: number) => v >= max ? 1 : v + 1)}><Text style={styles.dateArrow}>▲</Text></TouchableOpacity>
                  <Text style={styles.dateValue}>{val}</Text>
                  <TouchableOpacity onPress={() => setFn((v: number) => v <= 1 ? max : v - 1)}><Text style={styles.dateArrow}>▼</Text></TouchableOpacity>
                </View>
              );
            })}
          </View>
          <TouchableOpacity style={styles.dateSearchBtn} onPress={handleDateSearch}>
            <Text style={styles.dateSearchBtnText}>查看 {selYear}.{selMonth}.{selDay}</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="always" showsVerticalScrollIndicator={false}>
        {!hasSearched ? (
          <View style={styles.empty}><Text style={styles.emptyText}>—</Text></View>
        ) : results.length === 0 ? (
          <View style={styles.empty}><Text style={styles.emptyText}>没有找到</Text></View>
        ) : (
          <>
            <Text style={styles.resultCount}>找到 {results.length} 个瞬间</Text>
            {results.map(m => {
              const emoDef = getEmotionDef(m.emotion);
              return (
                <TouchableOpacity key={m.id} style={styles.resultCard} onPress={() => router.push(`/detail/${m.id}`)} activeOpacity={0.8}>
                  <Image source={{ uri: m.photoUri }} style={styles.resultImage} />
                  <View style={styles.resultMeta}>
                    {m.caption ? <Text style={styles.resultCaption} numberOfLines={3}>{m.caption}</Text> : null}
                    <View style={styles.resultFooter}>
                      {emoDef && <Text style={styles.resultEmotion}>{emoDef.emoji} {emoDef.label}</Text>}
                      <Text style={styles.resultTime}>
                        {new Date(m.createdAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  modeRow: { flexDirection: 'row', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, gap: Spacing.sm },
  modeBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  modeBtnActive: { backgroundColor: Colors.text, borderColor: Colors.text },
  modeText: { fontSize: FontSize.xs, color: Colors.textSecondary },
  modeTextActive: { color: Colors.white },
  searchBar: { flexDirection: 'row', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, gap: Spacing.sm },
  searchInput: { flex: 1, borderBottomWidth: 1, borderBottomColor: Colors.border, paddingVertical: 10, fontSize: FontSize.md, color: Colors.text },
  searchBtn: { borderWidth: 1, borderColor: Colors.text, paddingHorizontal: Spacing.lg, justifyContent: 'center' },
  searchBtnText: { fontSize: FontSize.xs, color: Colors.text },
  datePicker: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  dateRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: Spacing.xs },
  dateCol: { alignItems: 'center', width: 56 },
  dateArrow: { fontSize: 12, color: Colors.textSecondary, paddingVertical: 6 },
  dateValue: { fontSize: FontSize.xxxl, fontWeight: '200', color: Colors.text, paddingVertical: 4 },
  dateSearchBtn: { marginTop: Spacing.lg, height: 44, borderWidth: 1, borderColor: Colors.text, justifyContent: 'center', alignItems: 'center' },
  dateSearchBtnText: { fontSize: FontSize.sm, color: Colors.text, fontWeight: '300' },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.lg, paddingBottom: 40 },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyText: { fontSize: FontSize.md, color: Colors.textSecondary, fontWeight: '200' },
  resultCount: { fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: Spacing.md },
  resultCard: { flexDirection: 'row', marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  resultImage: { width: 72, height: 72, backgroundColor: Colors.secondary },
  resultMeta: { flex: 1, padding: Spacing.md, justifyContent: 'center' },
  resultCaption: { fontSize: FontSize.sm, color: Colors.text, lineHeight: 20, marginBottom: 2 },
  resultFooter: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  resultEmotion: { fontSize: 12, color: Colors.textSecondary },
  resultTime: { fontSize: 10, color: Colors.textSecondary },
});
