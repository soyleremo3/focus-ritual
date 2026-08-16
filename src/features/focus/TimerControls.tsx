import { View } from 'react-native';

import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import { Text } from '@/components/Text';
import type { TimerSession } from '@/domain/timer/types';
import { useTheme } from '@/theme/ThemeProvider';
import type { ScenePalette } from '@/theme/scenePalettes';

export interface TimerControlsProps {
  session: TimerSession | null;
  palette: ScenePalette;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onAdvancePhase: () => void;
  onContinueFocus: () => void;
  onCancel: () => void;
}

export function TimerControls({
  session,
  palette,
  onStart,
  onPause,
  onResume,
  onAdvancePhase,
  onContinueFocus,
  onCancel,
}: TimerControlsProps) {
  const theme = useTheme();
  const gap = theme.spacing.sm;

  if (!session || session.status === 'cancelled' || session.status === 'completed') {
    return (
      <View style={{ alignItems: 'center', gap }}>
        {session?.status === 'completed' && (
          <Text variant="label" color={palette.textMuted}>
            Session complete
          </Text>
        )}
        <Button label="Start Focus" onPress={onStart} backgroundColor={palette.accent} textColor={palette.onAccent} />
      </View>
    );
  }

  if (session.status === 'running') {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <IconButton icon="x" onPress={onCancel} color={palette.textMuted} backgroundColor={palette.surface} />
        <Button label="Pause" onPress={onPause} backgroundColor={palette.accent} textColor={palette.onAccent} />
      </View>
    );
  }

  if (session.status === 'paused') {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <IconButton icon="x" onPress={onCancel} color={palette.textMuted} backgroundColor={palette.surface} />
        <Button label="Resume" onPress={onResume} backgroundColor={palette.accent} textColor={palette.onAccent} />
      </View>
    );
  }

  // awaiting-start
  const isFlowDecision = session.mode === 'flow' && session.phase === 'focus';

  if (isFlowDecision) {
    return (
      <View style={{ alignItems: 'center', gap }}>
        <Text variant="label" color={palette.textMuted}>
          Keep the flow?
        </Text>
        <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
          <Button
            label="Take a Break"
            variant="secondary"
            onPress={onAdvancePhase}
            backgroundColor={palette.surface}
            textColor={palette.text}
          />
          <Button label="Keep Going" onPress={onContinueFocus} backgroundColor={palette.accent} textColor={palette.onAccent} />
        </View>
      </View>
    );
  }

  const nextLabel = session.phase === 'focus' ? 'Start Break' : 'Start Focus';
  const completeLabel = session.phase === 'focus' ? 'Focus complete' : 'Break complete';

  return (
    <View style={{ alignItems: 'center', gap }}>
      <Text variant="label" color={palette.textMuted}>
        {completeLabel}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <IconButton icon="x" onPress={onCancel} color={palette.textMuted} backgroundColor={palette.surface} />
        <Button label={nextLabel} onPress={onAdvancePhase} backgroundColor={palette.accent} textColor={palette.onAccent} />
      </View>
    </View>
  );
}
