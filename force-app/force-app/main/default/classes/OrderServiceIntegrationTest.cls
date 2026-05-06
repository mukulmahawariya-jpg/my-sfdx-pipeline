@isTest
public class OrderServiceIntegrationTest {

    @isTest
    static void testCalculateTotal_multipleItems_endToEnd() {
        List<Decimal> amounts = new List<Decimal>{ 100.0, 250.0, 49.99 };
        Decimal total = OrderService.calculateTotal(amounts);
        System.assertEquals(399.99, total);
    }

    @isTest
    static void testGetOrderStatus_chainedCalls() {
        String status1 = OrderService.getOrderStatus('ORD-100');
        String status2 = OrderService.getOrderStatus('ORD-101');
        System.assertEquals(status1, status2);
    }
}
