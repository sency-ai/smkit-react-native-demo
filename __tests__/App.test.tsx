/**
 * @format
 */

import 'react-native';
import React from 'react';
import App from '../App';

// Note: import explicitly to use the types shipped with jest.
import {it, jest} from '@jest/globals';

// Note: test renderer must be required after react-native.
import renderer, {act} from 'react-test-renderer';

jest.mock('@sency/react-native-smkit', () => {
  const R = require('react');
  const {View} = require('react-native');
  return {
    configure: () => Promise.resolve('ok'),
    SmkitCameraView: R.forwardRef((_props: object, _ref: unknown) =>
      R.createElement(View, {testID: 'smkit-camera-mock'}),
    ),
  };
});

it('renders correctly', async () => {
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<App />);
  });
  await act(async () => {
    await new Promise<void>((resolve) => setImmediate(resolve));
  });
  await act(() => {
    tree.unmount();
  });
});
