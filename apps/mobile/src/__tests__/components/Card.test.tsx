import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/Card';

// Mock the theme store
jest.mock('@/stores/theme', () => ({
  useThemeStore: () => ({
    colorScheme: 'light',
  }),
}));

describe('Card Component', () => {
  it('renders children correctly', () => {
    const { getByText } = render(
      <Card>
        <Text>Card Content</Text>
      </Card>
    );
    expect(getByText('Card Content')).toBeTruthy();
  });

  it('calls onPress when card is pressed', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <Card onPress={onPress}>
        <Text>Pressable Card</Text>
      </Card>
    );
    
    fireEvent.press(getByText('Pressable Card'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders CardHeader correctly', () => {
    const { getByText } = render(
      <CardHeader>
        <Text>Header Content</Text>
      </CardHeader>
    );
    expect(getByText('Header Content')).toBeTruthy();
  });

  it('renders CardTitle correctly', () => {
    const { getByText } = render(<CardTitle>Card Title</CardTitle>);
    expect(getByText('Card Title')).toBeTruthy();
  });

  it('renders CardDescription correctly', () => {
    const { getByText } = render(
      <CardDescription>Card Description</CardDescription>
    );
    expect(getByText('Card Description')).toBeTruthy();
  });

  it('renders CardContent correctly', () => {
    const { getByText } = render(
      <CardContent>
        <Text>Content Area</Text>
      </CardContent>
    );
    expect(getByText('Content Area')).toBeTruthy();
  });

  it('renders CardFooter correctly', () => {
    const { getByText } = render(
      <CardFooter>
        <Text>Footer Area</Text>
      </CardFooter>
    );
    expect(getByText('Footer Area')).toBeTruthy();
  });

  it('renders complete card structure', () => {
    const { getByText } = render(
      <Card>
        <CardHeader>
          <CardTitle>My Card</CardTitle>
          <CardDescription>A description of this card</CardDescription>
        </CardHeader>
        <CardContent>
          <Text>Main content goes here</Text>
        </CardContent>
        <CardFooter>
          <Text>Footer content</Text>
        </CardFooter>
      </Card>
    );

    expect(getByText('My Card')).toBeTruthy();
    expect(getByText('A description of this card')).toBeTruthy();
    expect(getByText('Main content goes here')).toBeTruthy();
    expect(getByText('Footer content')).toBeTruthy();
  });
});









