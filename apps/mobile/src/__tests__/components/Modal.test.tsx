import React from 'react';
import { render } from '@testing-library/react-native';
import { Text, TouchableWithoutFeedback, View } from 'react-native';
import { Modal } from '@/components/ui/Modal';

jest.mock('@/stores/theme', () => ({
  useThemeStore: () => ({
    colorScheme: 'light',
  }),
}));

describe('Modal Component', () => {
  it('keeps interactive descendants exposed to assistive technology', () => {
    const screen = render(
      <Modal visible onClose={jest.fn()} title="Create resume">
        <Text>Resume title</Text>
      </Modal>
    );

    const touchableWrappers = screen.UNSAFE_getAllByType(TouchableWithoutFeedback);
    expect(touchableWrappers).toHaveLength(2);
    expect(touchableWrappers.every((wrapper) => wrapper.props.accessible === false)).toBe(true);

    const modalBoundary = screen
      .UNSAFE_getAllByType(View)
      .find((view) => view.props.accessibilityViewIsModal === true);
    expect(modalBoundary).toBeTruthy();
    expect(screen.getByText('Resume title')).toBeTruthy();
    expect(screen.getByLabelText('common.close')).toBeTruthy();
  });
});
