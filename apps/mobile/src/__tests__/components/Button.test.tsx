import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Button } from '@/components/ui/Button';

// Mock the theme store
jest.mock('@/stores/theme', () => ({
  useThemeStore: () => ({
    colorScheme: 'light',
  }),
}));

describe('Button Component', () => {
  it('renders correctly with text', () => {
    const { getByText } = render(<Button>Test Button</Button>);
    expect(getByText('Test Button')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <Button onPress={onPress}>Press Me</Button>
    );
    
    fireEvent.press(getByText('Press Me'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <Button onPress={onPress} disabled>
        Disabled Button
      </Button>
    );
    
    fireEvent.press(getByText('Disabled Button'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('shows loading indicator when loading', () => {
    const { queryByText, getByTestId } = render(
      <Button loading>Loading Button</Button>
    );
    
    // Text should not be visible when loading
    expect(queryByText('Loading Button')).toBeNull();
  });

  it('renders with different variants', () => {
    const variants = ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'] as const;
    
    variants.forEach((variant) => {
      const { getByText } = render(
        <Button variant={variant}>{variant} Button</Button>
      );
      expect(getByText(`${variant} Button`)).toBeTruthy();
    });
  });

  it('renders with different sizes', () => {
    const sizes = ['sm', 'default', 'lg', 'icon'] as const;
    
    sizes.forEach((size) => {
      const { getByText } = render(
        <Button size={size}>{size} Button</Button>
      );
      expect(getByText(`${size} Button`)).toBeTruthy();
    });
  });
});









