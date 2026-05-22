import { useRef, useState, useCallback, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert, Linking, Image, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions, type CameraType, type FlashMode } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius, FontSize } from '../../src/constants/theme';
import { useMoments, useStreak } from '../../src/hooks/useMoments';
import { getMomentsForDayOffset } from '../../src/db/momentsRepo';
import { getStreakLevel, getStreakEmoji } from '../../src/utils/streakEngine';
import type { Moment } from '../../src/types';

export default function NowScreen() {
  const router = useRouter();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState<FlashMode>('off');
  const [showGrid, setShowGrid] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [zoom, setZoom] = useState(0); // 0 = 1x
  const { moments } = useMoments(1);
  const streak = useStreak();
  const lastMoment = moments[0];
  const [lastWeekMoments, setLastWeekMoments] = useState<Moment[]>([]);
  const [lastMonthMoments, setLastMonthMoments] = useState<Moment[]>([]);

  const streakEmoji = getStreakEmoji(getStreakLevel(streak.currentStreak));

  const ZOOM_PRESETS = [
    { label: '.5', value: 0 },
    { label: '.8', value: 0 },
    { label: '1×', value: 0 },
    { label: '1.2', value: 0.05 },
    { label: '1.5', value: 0.12 },
    { label: '2', value: 0.2 },
  ];

  // Auto-request camera permission on mount
  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  useEffect(() => {
    getMomentsForDayOffset(7).then(setLastWeekMoments);
    getMomentsForDayOffset(30).then(setLastMonthMoments);
  }, []);

  const flipCamera = useCallback(() => {
    setFacing(prev => (prev === 'back' ? 'front' : 'back'));
  }, []);

  const takePhoto = useCallback(async () => {
    if (!cameraRef.current || isCapturing) return;
    setIsCapturing(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      router.push(`/caption?photoUri=${encodeURIComponent(photo.uri)}`);
    } catch (err) {
      Alert.alert('拍照失败', '请重试');
    } finally {
      setIsCapturing(false);
    }
  }, [isCapturing, router]);

  // On web, skip the permission gate — browser handles it natively
  if (!permission && Platform.OS !== 'web') {
    return (
      <View style={styles.container}>
        <View style={styles.permissionGate}>
          <Text style={styles.permissionTitle}>Moments</Text>
          <Text style={styles.permissionDesc}>记录你的每一个现在</Text>
        </View>
      </View>
    );
  }

  if (permission && !permission.granted) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionGate}>
          <Text style={styles.permissionEmoji}>📸</Text>
          <Text style={styles.permissionTitle}>需要相机权限</Text>
          <Text style={styles.permissionDesc}>Moments 需要访问相机来记录你的每一个瞬间</Text>
          <TouchableOpacity style={styles.permissionBtn} onPress={permission.canAskAgain ? requestPermission : () => Linking.openSettings()}>
            <Text style={styles.permissionBtnText}>{permission.canAskAgain ? '允许访问' : '前往设置'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing={facing} mode="picture" zoom={zoom} flash={flash}>
        {/* 网格线 */}
        {showGrid && (
          <View style={styles.gridOverlay} pointerEvents="none">
            <View style={styles.gridLineH} /><View style={styles.gridLineH} /><View style={styles.gridLineH} />
            <View style={styles.gridLineV} /><View style={styles.gridLineV} /><View style={styles.gridLineV} />
          </View>
        )}

        {/* 顶部栏 */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.roundBtn} onPress={() => router.push('/profile')}>
            <Text style={styles.roundBtnText}>👤</Text>
          </TouchableOpacity>

          {streak.currentStreak > 0 && (
            <View style={styles.streakBadge}>
              <Text style={styles.streakEmoji}>{streakEmoji}</Text>
              <Text style={styles.streakNum}>{streak.currentStreak}天</Text>
            </View>
          )}

          <TouchableOpacity style={styles.roundBtn} onPress={flipCamera}>
            <Text style={styles.roundBtnText}>🔄</Text>
          </TouchableOpacity>
        </View>

        {/* 右侧工具栏 */}
        <View style={styles.rightToolbar}>
          {/* 变焦按钮 */}
          {ZOOM_PRESETS.map((p, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.zoomBtn, zoom === p.value && styles.zoomBtnActive]}
              onPress={() => { setZoom(p.value); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
            >
              <Text style={[styles.zoomBtnText, zoom === p.value && styles.zoomBtnTextActive]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}

          <View style={styles.toolbarDivider} />

          {/* 闪光灯 */}
          <TouchableOpacity
            style={styles.toolBtn}
            onPress={() => setFlash(f => f === 'off' ? 'on' : f === 'on' ? 'auto' : 'off')}
          >
            <Text style={styles.toolBtnText}>{flash === 'off' ? '⚡' : flash === 'on' ? '💡' : '🔆'}</Text>
          </TouchableOpacity>

          {/* 网格 */}
          <TouchableOpacity
            style={[styles.toolBtn, showGrid && styles.toolBtnActive]}
            onPress={() => setShowGrid(g => !g)}
          >
            <Text style={styles.toolBtnText}>⊞</Text>
          </TouchableOpacity>
        </View>

        {/* 回看提示 */}
        {lastWeekMoments.length > 0 && (
          <TouchableOpacity style={styles.hintBadge} onPress={() => router.push('/(tabs)/review')}>
            <Text style={styles.hintText}>📅 上周今天有 {lastWeekMoments.length} 个瞬间</Text>
          </TouchableOpacity>
        )}
        {lastMonthMoments.length > 0 && (
          <TouchableOpacity style={[styles.hintBadge, { top: 148 }]} onPress={() => router.push('/(tabs)/review')}>
            <Text style={styles.hintText}>🗓️ 上月今天有 {lastMonthMoments.length} 个瞬间</Text>
          </TouchableOpacity>
        )}

        {/* 最后一张缩略图 */}
        {lastMoment && (
          <TouchableOpacity style={styles.lastPreview} onPress={() => router.push(`/detail/${lastMoment.id}`)}>
            <Image source={{ uri: lastMoment.photoUri }} style={styles.lastPreviewImg} />
          </TouchableOpacity>
        )}
      </CameraView>

      {/* 底部拍照键 */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.captureBtn, isCapturing && { opacity: 0.5 }]}
          onPress={takePhoto} disabled={isCapturing} activeOpacity={0.7}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark },
  camera: { flex: 1 },
  topBar: {
    position: 'absolute', top: 56, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.lg, zIndex: 10,
  },
  roundBtn: {
    width: 40, height: 40, borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center',
  },
  roundBtnText: { fontSize: 18 },
  streakBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: Radius.full,
  },
  streakEmoji: { fontSize: 14 },
  streakNum: { fontSize: 14, fontWeight: '700', color: '#FFB84D' },
  hintBadge: {
    position: 'absolute', top: 120, left: Spacing.lg, zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: Radius.full,
    paddingHorizontal: 14, paddingVertical: 6,
  },
  hintText: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.85)' },
  lastPreview: {
    position: 'absolute', bottom: 20, left: Spacing.lg,
    width: 44, height: 44, borderRadius: Radius.md,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)', overflow: 'hidden', zIndex: 10,
  },
  lastPreviewImg: { width: '100%', height: '100%' },
  controls: {
    backgroundColor: Colors.dark, paddingVertical: 24, paddingBottom: 36,
    alignItems: 'center', justifyContent: 'center',
  },
  captureBtn: {
    width: 76, height: 76, borderRadius: 38,
    borderWidth: 5, borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 8,
  },
  // Grid
  gridOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 5,
    justifyContent: 'space-evenly',
  },
  gridLineH: {
    flex: 1, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.25)',
  },
  gridLineV: {
    position: 'absolute', top: 0, bottom: 0,
    width: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.25)',
  },
  // Right toolbar
  rightToolbar: {
    position: 'absolute', top: 120, right: Spacing.lg, zIndex: 10,
    alignItems: 'center', gap: 6,
  },
  zoomBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center',
  },
  zoomBtnActive: { backgroundColor: 'rgba(255,255,255,0.85)' },
  zoomBtnText: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.8)' },
  zoomBtnTextActive: { color: Colors.dark },
  toolbarDivider: { width: 20, height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 2 },
  toolBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center',
  },
  toolBtnActive: { backgroundColor: 'rgba(255,255,255,0.3)' },
  toolBtnText: { fontSize: 14, color: 'rgba(255,255,255,0.8)' },
  // Permission
  permissionGate: {
    flex: 1, backgroundColor: Colors.bg, justifyContent: 'center',
    alignItems: 'center', padding: Spacing.xxxl, gap: Spacing.md,
  },
  permissionEmoji: { fontSize: 64, marginBottom: Spacing.md },
  permissionTitle: { fontSize: 22, fontWeight: '700', color: Colors.text },
  permissionDesc: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  permissionBtn: {
    marginTop: Spacing.xl, backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xxxl, paddingVertical: 14, borderRadius: Radius.lg,
  },
  permissionBtnText: { color: Colors.white, fontSize: 17, fontWeight: '600' },
});
