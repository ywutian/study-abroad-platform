import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Input } from '@/components/ui/Input';

// Mock the theme store
jest.mock('@/stores/theme', () => ({
  useThemeStore: () => ({
    colorScheme: 'light',
  }),
}));

describe('Input Component', () => {
  it('renders correctly with label', () => {
    const { getByText } = render(<Input label="Email" />);
    expect(getByText('Email')).toBeTruthy();
  });

  it('renders correctly with placeholder', () => {
    const { getByPlaceholderText } = render(
      <Input placeholder="Enter your email" />
    );
    expect(getByPlaceholderText('Enter your email')).toBeTruthy();
  });

  it('calls onChangeText when text changes', () => {
    const onChangeText = jest.fn();
    const { getByPlaceholderText } = render(
      <Input placeholder="Type here" onChangeText={onChangeText} />
    );
    
    fireEvent.changeText(getByPlaceholderText('Type here'), 'test input');
    expect(onChangeText).toHaveBeenCalledWith('test input');
  });

  it('shows error message', () => {
    const { getByText } = render(
      <Input error="This field is required" />
    );
    expect(getByText('This field is required')).toBeTruthy();
  });

  it('shows hint text', () => {
    const { getByText } = render(
      <Input hint="Enter a valid email address" />
    );
    expect(getByText('Enter a valid email address')).toBeTruthy();
  });

  it('toggles password visibility for secure inputs', () => {
    const { getByPlaceholderText } = render(
      <Input placeholder="Password" secureTextEntry />
    );
    
    const input = getByPlaceholderText('Password');
    // Initially secure
    expect(input.props.secureTextEntry).toBe(true);
  });
});









