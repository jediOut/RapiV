import { StyleSheet } from "react-native";
import { colors } from "../../theme/colors";

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  statusBadge: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '800',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  itemQuantity: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: 13,
    color: colors.text,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  addressText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  map: {
    borderRadius: 8,
    height: 240,
    overflow: 'hidden',
  },
  paymentPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 12,
  },
  paymentStatus: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  paymentHint: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  refundNotice: {
    backgroundColor: colors.danger,
    borderColor: colors.dangerText,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
    padding: 12,
  },
  refundNoticeTitle: {
    color: colors.dangerText,
    fontSize: 14,
    fontWeight: '800',
  },
  refundNoticeBody: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  ratingError: {
    color: colors.dangerText,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  ratingRow: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    padding: 12,
  },
  ratingHeader: {
    flex: 1,
    gap: 3,
  },
  ratingLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  ratingDone: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '900',
  },
  ratingStars: {
    flexDirection: 'row',
    gap: 4,
  },
  ratingStarButton: {
    alignItems: 'center',
    borderRadius: 8,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  ratingStarDisabled: {
    opacity: 0.5,
  },
});
