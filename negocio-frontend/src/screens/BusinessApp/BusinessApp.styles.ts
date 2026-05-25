import { StyleSheet } from "react-native";
import { colors } from "../../theme/colors";

export const styles = StyleSheet.create({
  appShell: {
    backgroundColor:
      colors.background,
    flex: 1
  },

  content: {
    flex: 1
  },

  contentInner: {
    padding: 18,
    paddingBottom: 110
  }
});
