import { StyleSheet } from "react-native";
import { colors } from "../../theme/colors";

export const styles = StyleSheet.create({
  panel: {
    backgroundColor:
      colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
    padding: 16
  },

  sectionTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 20
  },

  field: {
    marginBottom: 18
  },

  logoRow: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    marginBottom: 18,
    padding: 12
  },

  logoPreview: {
    borderRadius: 12,
    height: 64,
    width: 64
  },

  logoPlaceholder: {
    alignItems: "center",
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
    height: 64,
    justifyContent: "center",
    width: 64
  },

  logoPlaceholderText: {
    color: colors.primary,
    fontSize: 26,
    fontWeight: "900"
  },

  logoContent: {
    flex: 1
  },

  logoButton: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primaryBorder,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10
  },

  logoButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "800"
  },

  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8
  },

  input: {
    backgroundColor:
      colors.background,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12
  },

  textArea: {
    minHeight: 90,
    textAlignVertical: "top"
  },

  paymentOptions: {
    flexDirection: "row",
    gap: 10
  },

  stripePanel: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    padding: 12
  },

  stripeStatus: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 4
  },

  stripeDescription: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12
  },

  stripeActions: {
    flexDirection: "row",
    gap: 10
  },

  stripeButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 10,
    flex: 1,
    paddingVertical: 12
  },

  stripeButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800"
  },

  stripeButtonSecondary: {
    alignItems: "center",
    backgroundColor: colors.primaryLight,
    borderColor: colors.primaryBorder,
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 12
  },

  stripeButtonSecondaryText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "800"
  },

  stripeButtonDisabled: {
    opacity: 0.5
  },

  paymentOption: {
    alignItems: "center",
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 13
  },

  paymentOptionActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary
  },

  paymentOptionDisabled: {
    opacity: 0.55
  },

  paymentOptionText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "800"
  },

  paymentOptionTextActive: {
    color: colors.primary
  },

  paymentOptionTextDisabled: {
    color: colors.textMuted
  },

  switchContainer: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent:
      "space-between",
    marginBottom: 22
  },

  switchDescription: {
    color: colors.textMuted,
    fontSize: 13
  },

  commissionPanel: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 18,
    padding: 12
  },

  commissionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8
  },

  commissionTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800"
  },

  commissionStatus: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "800"
  },

  commissionStatusPending: {
    color: colors.primary
  },

  commissionAmount: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 4
  },

  commissionDescription: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18
  },

  mapHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent:
      "space-between",
    marginBottom: 10
  },

  locationButton: {
    backgroundColor:
      colors.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10
  },

  locationButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700"
  },

  locationSummary: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10
  },

  mapContainer: {
    borderRadius: 14,
    height: 260,
    marginBottom: 14,
    overflow: "hidden",
    position: "relative"
  },

  map: {
    flex: 1
  },

  centerMarker: {
    alignItems: "center",
    justifyContent: "center",
    left: "50%",
    marginLeft: -18,
    marginTop: -36,
    position: "absolute",
    top: "50%"
  },

  centerMarkerIcon: {
    fontSize: 36
  },

  confirmButton: {
    alignItems: "center",
    backgroundColor:
      colors.background,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 18,
    paddingVertical: 14
  },

  confirmButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800"
  },

  saveButton: {
    alignItems: "center",
    backgroundColor:
      colors.primary,
    borderRadius: 12,
    paddingVertical: 15
  },

  saveButtonDisabled: {
    opacity: 0.6
  },

  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800"
  }
});
