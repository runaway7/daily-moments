import { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Colors, Spacing, Radius, FontSize } from '../src/constants/theme';
import { getAccount, registerAccount, verifyPassword, resetPassword } from '../src/db/accountRepo';

const QUESTIONS = [
  '你的小学叫什么名字？',
  '你最喜欢的电影是什么？',
  '你的宠物叫什么名字？',
  '你出生的城市是哪里？',
  '你最喜欢的食物是什么？',
];

export default function LoginScreen() {
  const router = useRouter();

  // Figure out initial mode
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('register');
  const [ready, setReady] = useState(false);

  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const acct = await getAccount();
        if (acct && acct.hasPassword) {
          setMode('login');
          setQuestion(acct.securityQuestion || '');
        } else {
          setMode('register');
        }
      } catch {}
      setReady(true);
    })();
  }, []);

  const submit = useCallback(async () => {
    try {
      if (mode === 'register') {
        if (!nickname.trim()) { Alert.alert('请输入昵称'); return; }
        if (password.length < 4) { Alert.alert('密码至少4位'); return; }
        if (password !== confirmPw) { Alert.alert('两次密码不一致'); return; }
        if (!question.trim()) { Alert.alert('请选择或输入密保问题'); return; }
        if (!answer.trim()) { Alert.alert('请输入密保答案'); return; }
        await registerAccount(nickname.trim(), password, question.trim(), answer.trim());
        Alert.alert('', '注册成功，请牢记你的密码和密保答案');
        router.back();
      } else if (mode === 'login') {
        const ok = await verifyPassword(password);
        if (ok) { router.back(); } else { Alert.alert('', '密码错误'); }
      } else if (mode === 'forgot') {
        if (password.length < 4) { Alert.alert('', '新密码至少4位'); return; }
        if (!answer.trim()) { Alert.alert('', '请输入密保答案'); return; }
        const ok = await resetPassword(password, answer.trim());
        if (ok) {
          Alert.alert('', '密码已重置');
          setMode('login'); setPassword(''); setAnswer('');
        } else { Alert.alert('', '密保答案错误'); }
      }
    } catch (e: any) {
      console.error('[login] submit error:', e);
      Alert.alert('', '操作失败: ' + (e?.message || '请重试'));
    }
  }, [mode, nickname, password, confirmPw, question, answer, router]);

  if (!ready) {
    return <View style={styles.container}><Stack.Screen options={{ headerShown: true, title: '...', headerStyle: { backgroundColor: Colors.bg }, headerTintColor: Colors.text, headerShadowVisible: false }} /></View>;
  }

  const title = mode === 'register' ? '创建账户' : mode === 'forgot' ? '重置密码' : '登录';
  const btnLabel = mode === 'register' ? '注册' : mode === 'forgot' ? '重置密码' : '登录';

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ headerShown: true, title, headerStyle: { backgroundColor: Colors.bg }, headerTintColor: Colors.text, headerTitleStyle: { fontWeight: '600', color: Colors.text }, headerShadowVisible: false }} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="always">

        {/* Nickname — register only */}
        {mode === 'register' && (
          <View style={styles.field}>
            <Text style={styles.label}>昵称</Text>
            <TextInput style={styles.input} value={nickname} onChangeText={setNickname} placeholder="给自己起个名字" placeholderTextColor={Colors.textSecondary} maxLength={20} />
          </View>
        )}

        {/* Password */}
        <View style={styles.field}>
          <Text style={styles.label}>{mode === 'forgot' ? '新密码' : '密码'}</Text>
          <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="至少4位" placeholderTextColor={Colors.textSecondary} secureTextEntry maxLength={20} />
        </View>

        {/* Confirm — register only */}
        {mode === 'register' && (
          <View style={styles.field}>
            <Text style={styles.label}>确认密码</Text>
            <TextInput style={styles.input} value={confirmPw} onChangeText={setConfirmPw} placeholder="再次输入密码" placeholderTextColor={Colors.textSecondary} secureTextEntry maxLength={20} />
          </View>
        )}

        {/* Security question — register only */}
        {mode === 'register' && (
          <View style={styles.field}>
            <Text style={styles.label}>密保问题（用于找回密码）</Text>
            <View style={styles.chipRow}>
              {QUESTIONS.map(q => (
                <TouchableOpacity key={q} style={[styles.chip, question === q && styles.chipActive]} onPress={() => setQuestion(q)}>
                  <Text style={[styles.chipText, question === q && styles.chipTextActive]}>{q}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput style={[styles.input, { marginTop: Spacing.sm }]} value={question} onChangeText={setQuestion} placeholder="或自定义密保问题" placeholderTextColor={Colors.textSecondary} maxLength={50} />
          </View>
        )}

        {/* Security answer — register & forgot */}
        {(mode === 'register' || mode === 'forgot') && (
          <View style={styles.field}>
            <Text style={styles.label}>{mode === 'forgot' ? '密保答案：' + question : '密保答案'}</Text>
            <TextInput style={styles.input} value={answer} onChangeText={setAnswer} placeholder="输入你的答案" placeholderTextColor={Colors.textSecondary} maxLength={50} />
          </View>
        )}

        {/* Submit */}
        <TouchableOpacity style={styles.btn} onPress={submit} activeOpacity={0.7}>
          <Text style={styles.btnText}>{btnLabel}</Text>
        </TouchableOpacity>

        {/* Footer links */}
        <View style={styles.footer}>
          {mode === 'login' && (
            <>
              <TouchableOpacity onPress={() => { setMode('register'); setPassword(''); setConfirmPw(''); setQuestion(''); setAnswer(''); }}><Text style={styles.link}>注册新账号</Text></TouchableOpacity>
              <Text style={styles.linkSep}>|</Text>
              <TouchableOpacity onPress={() => { setMode('forgot'); setPassword(''); setAnswer(''); }}><Text style={styles.link}>忘记密码</Text></TouchableOpacity>
            </>
          )}
          {(mode === 'register' || mode === 'forgot') && (
            <TouchableOpacity onPress={() => { setMode('login'); setPassword(''); }}><Text style={styles.link}>返回登录</Text></TouchableOpacity>
          )}
        </View>

        <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}><Text style={styles.cancelText}>取消</Text></TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.lg, paddingBottom: 40 },
  field: { marginBottom: Spacing.xl },
  label: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary, marginBottom: Spacing.sm },
  input: {
    backgroundColor: Colors.white, borderRadius: Radius.lg, paddingHorizontal: Spacing.lg, paddingVertical: 14,
    fontSize: FontSize.md, color: Colors.text, borderWidth: 1, borderColor: Colors.border,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full, backgroundColor: Colors.secondary },
  chipActive: { backgroundColor: Colors.primary },
  chipText: { fontSize: FontSize.xs, color: Colors.textSecondary },
  chipTextActive: { color: Colors.white, fontWeight: '600' },
  btn: {
    height: 52, backgroundColor: Colors.primary, borderRadius: Radius.lg,
    justifyContent: 'center', alignItems: 'center', marginTop: Spacing.md,
  },
  btnText: { color: Colors.white, fontSize: 17, fontWeight: '600' },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: Spacing.xl, gap: Spacing.md },
  link: { fontSize: FontSize.sm, color: Colors.primary },
  linkSep: { color: Colors.border },
  cancelBtn: { marginTop: Spacing.xl, alignSelf: 'center' },
  cancelText: { fontSize: FontSize.sm, color: Colors.textSecondary },
});
