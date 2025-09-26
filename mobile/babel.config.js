module.exports = {
  presets: ['module:metro-react-native-babel-preset'],
  plugins: [
    'react-native-reanimated/plugin',
    [
      'module-resolver',
      {
        root: ['./src'],
        alias: {
          '@': './src',
          '@/components': './src/components',
          '@/screens': './src/screens',
          '@/services': './src/services',
          '@/types': './src/types',
          '@/utils': './src/utils',
          '@/hooks': './src/hooks',
          '@/store': './src/store',
        },
      },
    ],
  ],
};