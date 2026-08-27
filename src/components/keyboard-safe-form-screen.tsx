import { PropsWithChildren, RefObject } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleProp, StyleSheet, TouchableWithoutFeedback, View, ViewStyle } from 'react-native';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';

import { Palette } from '@/constants/theme';

type KeyboardSafeFormScreenProps = PropsWithChildren<{
  contentStyle?: StyleProp<ViewStyle>;
  keyboardVerticalOffset?: number;
  safeAreaEdges?: Edge[];
  scrollViewRef?: RefObject<ScrollView | null>;
}>;

const defaultSafeAreaEdges: Edge[] = ['top', 'right', 'bottom', 'left'];

export function KeyboardSafeFormScreen({
  children,
  contentStyle,
  keyboardVerticalOffset = 0,
  safeAreaEdges = defaultSafeAreaEdges,
  scrollViewRef,
}: KeyboardSafeFormScreenProps) {
  return (
    <SafeAreaView edges={safeAreaEdges} style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}
        keyboardVerticalOffset={keyboardVerticalOffset}>
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {Platform.OS === 'web' ? (
            // On web there is no software keyboard to dismiss, and wrapping the
            // content in TouchableWithoutFeedback makes it swallow clicks meant
            // for the inputs and buttons underneath it.
            <View style={[styles.content, contentStyle]}>{children}</View>
          ) : (
            <TouchableWithoutFeedback accessible={false} onPress={Keyboard.dismiss}>
              <View style={[styles.content, contentStyle]}>{children}</View>
            </TouchableWithoutFeedback>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.white },
  keyboardView: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  content: { flexGrow: 1 },
});
