import { Component, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Top-level crash guard for the whole app — without this, any render-time error (a bad prop,
 * a corrupted-state edge case not otherwise caught) white-screens the app permanently, with
 * no way back in short of reinstalling. Deliberately uses raw React Native primitives with
 * hardcoded colors rather than the themed Text/Button/useTheme — this boundary sits above
 * ThemeProvider specifically so it can also catch a crash *in* ThemeProvider, at which point
 * useTheme() would itself throw.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error('[ErrorBoundary] caught render error', error, info.componentStack);
  }

  private handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#17130E',
            paddingHorizontal: 32,
            gap: 12,
          }}
        >
          <Text style={{ color: '#F3ECE0', fontSize: 20, fontWeight: '600', textAlign: 'center' }}>
            Something went wrong
          </Text>
          <Text style={{ color: '#A69C8B', fontSize: 14, textAlign: 'center' }}>
            FocusRitual hit an unexpected error. Your rituals, spaces, and history are saved locally and
            are not affected.
          </Text>
          <Pressable
            onPress={this.handleRetry}
            accessibilityRole="button"
            accessibilityLabel="Try again"
            style={{
              marginTop: 8,
              paddingVertical: 10,
              paddingHorizontal: 24,
              borderRadius: 999,
              backgroundColor: '#E8935B',
            }}
          >
            <Text style={{ color: '#241C12', fontSize: 14, fontWeight: '600' }}>Try Again</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}
