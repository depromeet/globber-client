const { getDefaultConfig } = require("expo/metro-config");

// Expo SDK 52+ 는 모노레포(workspace) 설정을 자동으로 감지합니다.
// (watchFolders, nodeModulesPaths 수동 설정 불필요)
module.exports = getDefaultConfig(__dirname);
