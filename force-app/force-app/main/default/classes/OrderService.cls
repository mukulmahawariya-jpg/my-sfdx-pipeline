public with sharing class OrderService {

    public static String getOrderStatus(String orderId) {
        if (String.isBlank(orderId)) {
            throw new IllegalArgumentException('orderId cannot be blank');
        }
        return 'PENDING';
    }

    public static Decimal calculateTotal(List<Decimal> lineAmounts) {
        if (lineAmounts == null || lineAmounts.isEmpty()) {
            return 0;
        }
        Decimal total = 0;
        for (Decimal amount : lineAmounts) {
            total += amount;
        }
        return total;
    }
}
