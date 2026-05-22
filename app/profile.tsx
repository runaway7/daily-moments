import { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Alert, Share } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Paths, File, Directory } from 'expo-file-system';
import { Colors, Spacing, Radius, FontSize } from '../src/constants/theme';
import { getMomentCount, getStreakState, getFavoriteMoments, getAllMoments, getAppendNotes } from '../src/db/momentsRepo';
import { getAccount } from '../src/db/accountRepo';
import { getStorageStats } from '../src/services/fileStorage';
import { getStreakLevel, getStreakEmoji, getStreakLabel, getFreezeCardsPerWeek } from '../src/utils/streakEngine';

export default function ProfileScreen() {
  const router = useRouter();

  const [nickname, setNickname] = useState('');
  const [hasPassword, setHasPassword] = useState(false);
  const [totalMoments, setTotalMoments] = useState(0);
  const [photoCount, setPhotoCount] = useState(0);
  const [totalSizeMB, setTotalSizeMB] = useState(0);
  const [favCount, setFavCount] = useState(0);
  const [streak, setStreak] = useState({ currentStreak: 0, longestStreak: 0, freezeCards: 0 });

  // Fire and forget — never block the UI
  useEffect(() => {
    getMomentCount().then(v => setTotalMoments(v)).catch(() => {});
    getFavoriteMoments(200).then(v => setFavCount(v.length)).catch(() => {});
    getAccount().then(v => { if (v) { setNickname(v.nickname); setHasPassword(v.hasPassword); } }).catch(() => {});
    getStreakState().then(v => setStreak({ currentStreak: v.currentStreak, longestStreak: v.longestStreak, freezeCards: v.freezeCards })).catch(() => {});
    getStorageStats().then(v => { setPhotoCount(v.photoCount); setTotalSizeMB(v.totalSizeMB); }).catch(() => {});
  }, []);

  const streakLevel = getStreakLevel(streak.currentStreak);
  const streakEmoji = getStreakEmoji(streakLevel);
  const streakLabel = getStreakLabel(streakLevel);
  const cardsPerWeek = getFreezeCardsPerWeek(streakLevel);

  const handleExport = async () => {
    try {
      const moments = await getAllMoments(500);
      let md = '# My Moments\n\n' + new Date().toLocaleString('zh-CN') + '\n' + moments.length + ' 个瞬间\n\n---\n\n';
      for (const m of moments) {
        md += '## ' + new Date(m.createdAt).toLocaleString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) + '\n\n';
        if (m.caption) md += m.caption + '\n\n';
        if (m.emotion) md += '情绪: ' + m.emotion + '\n\n';
        if (m.emotionReason) md += '> ' + m.emotionReason + '\n\n';
        if (m.tags.length) md += '标签: ' + m.tags.join(', ') + '\n\n';
        const notes = await getAppendNotes(m.id);
        if (notes.length) { md += '### 追评\n\n'; for (const n of notes) md += '- ' + n.text + '\n'; md += '\n'; }
        md += '---\n\n';
      }
      try {
        const dir = new Directory(Paths.document, 'exports');
        dir.create({ intermediates: true });
        const f = new File(dir, 'moments_' + new Date().toISOString().slice(0, 10) + '.md');
        f.create({ overwrite: true });
        f.write(md);
      } catch {}
      Alert.alert('', '导出成功');
      Share.share({ message: md }).catch(() => {});
    } catch (e) { Alert.alert('导出失败'); }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: true, title: '我的', headerStyle: { backgroundColor: Colors.bg }, headerTintColor: Colors.text, headerTitleStyle: { fontWeight: '600', color: Colors.text }, headerShadowVisible: false }} />

      {/* 账户 — 始终可点击，绝不阻塞 */}
      <TouchableOpacity style={styles.accountCard} onPress={() => router.push('/login')} activeOpacity={0.7}>
        <View style={styles.avatarWrap}><Text style={styles.avatarEmoji}>{hasPassword ? '🔒' : '👤'}</Text></View>
        <View style={styles.accountText}>
          <Text style={styles.accountName}>{nickname || '未设置账户'}</Text>
          <Text style={styles.accountHint}>{hasPassword ? '已设置密码保护' : '点击设置密码保护你的日记'}</Text>
        </View>
        <Text style={styles.accountArrow}>›</Text>
      </TouchableOpacity>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* 火花 */}
        <View style={styles.card}>
          <View style={styles.streakMain}>
            <Text style={styles.streakEmojiText}>{streakEmoji}</Text>
            <Text style={styles.streakNum}>{streak.currentStreak} 天</Text>
            <Text style={styles.streakLevel}>{streakLabel}</Text>
          </View>
          <View style={styles.streakRow}>
            <View style={styles.streakItem}><Text style={styles.streakItemIcon}>🏆</Text><Text style={styles.streakItemVal}>{streak.longestStreak}天</Text><Text style={styles.streakItemLabel}>最长</Text></View>
            <View style={styles.streakItem}><Text style={styles.streakItemIcon}>🛡️</Text><Text style={styles.streakItemVal}>×{streak.freezeCards}</Text><Text style={styles.streakItemLabel}>冻结卡</Text></View>
            {cardsPerWeek > 0 && <View style={styles.streakItem}><Text style={styles.streakItemIcon}>🎁</Text><Text style={styles.streakItemVal}>+{cardsPerWeek}/周</Text><Text style={styles.streakItemLabel}>收入</Text></View>}
          </View>
        </View>

        {/* 数据 */}
        <Text style={styles.sectionTitle}>我的数据</Text>
        <View style={styles.statsRow}>
          <View style={styles.statBox}><Text style={styles.statNum}>{totalMoments}</Text><Text style={styles.statLabel}>总记录</Text></View>
          <View style={styles.statBox}><Text style={styles.statNum}>{photoCount}</Text><Text style={styles.statLabel}>照片</Text></View>
          <View style={styles.statBox}><Text style={styles.statNum}>{favCount}</Text><Text style={styles.statLabel}>精选</Text></View>
          <View style={styles.statBox}><Text style={styles.statNum}>{totalSizeMB}</Text><Text style={styles.statLabel}>MB</Text></View>
        </View>

        {/* 导出 */}
        <Text style={styles.sectionTitle}>数据管理</Text>
        <TouchableOpacity style={styles.exportBtn} onPress={handleExport} activeOpacity={0.7}>
          <Text style={styles.exportBtnText}>导出 Markdown</Text>
          <Text style={styles.exportHint}>将所有记录导出为 Markdown 文件，可分享</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Moments v1.2.0{'\n'}数据仅保存在你的设备上</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  accountCard: { flexDirection: 'row', alignItems: 'center', marginHorizontal: Spacing.lg, marginTop: Spacing.lg, padding: Spacing.lg, borderRadius: Radius.xl, backgroundColor: Colors.white, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  avatarWrap: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.secondary, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
  avatarEmoji: { fontSize: 22 },
  accountText: { flex: 1 },
  accountName: { fontSize: FontSize.lg, fontWeight: '600', color: Colors.text },
  accountHint: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  accountArrow: { fontSize: 24, color: Colors.textSecondary },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.lg, paddingTop: 0, paddingBottom: 40 },
  card: { backgroundColor: Colors.white, borderRadius: Radius.xl, padding: Spacing.lg, marginTop: Spacing.lg, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  streakMain: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.lg },
  streakEmojiText: { fontSize: 32 },
  streakNum: { fontSize: FontSize.xxl, fontWeight: '700', color: Colors.text },
  streakLevel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  streakRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.md },
  streakItem: { flex: 1, alignItems: 'center' },
  streakItemIcon: { fontSize: 16 },
  streakItemVal: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text, marginTop: 2 },
  streakItemLabel: { fontSize: FontSize.xs, color: Colors.textSecondary },
  sectionTitle: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary, marginTop: Spacing.xl, marginBottom: Spacing.md },
  statsRow: { flexDirection: 'row', gap: Spacing.md },
  statBox: { flex: 1, backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.lg, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 3, elevation: 1 },
  statNum: { fontSize: FontSize.xxl, fontWeight: '700', color: Colors.primary },
  statLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  exportBtn: { backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.lg },
  exportBtnText: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  exportHint: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  version: { textAlign: 'center', fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: Spacing.xxxl, lineHeight: 18 },
});
