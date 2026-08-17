import { Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { ErrorBoundary } from '../ErrorBoundary';

// Suppress React's noisy "error boundary" console.error during these intentional-throw tests.
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});
afterAll(() => {
  console.error = originalConsoleError;
});

let shouldThrow = true;
function Flaky() {
  if (shouldThrow) throw new Error('boom');
  return <Text>recovered</Text>;
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    shouldThrow = true;
  });

  it('renders children normally when nothing throws', () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(
        <ErrorBoundary>
          <Text>fine</Text>
        </ErrorBoundary>
      );
    });
    expect(renderer.root.findByType(Text).props.children).toBe('fine');
  });

  it('catches a render error and shows the fallback instead of crashing', () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(
        <ErrorBoundary>
          <Flaky />
        </ErrorBoundary>
      );
    });
    expect(renderer.root.findByProps({ accessibilityLabel: 'Try again' })).toBeTruthy();
  });

  it('re-renders children after Try Again is pressed', () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(
        <ErrorBoundary>
          <Flaky />
        </ErrorBoundary>
      );
    });
    shouldThrow = false;
    act(() => {
      renderer.root.findByProps({ accessibilityLabel: 'Try again' }).props.onPress();
    });
    expect(renderer.root.findByType(Text).props.children).toBe('recovered');
  });
});
