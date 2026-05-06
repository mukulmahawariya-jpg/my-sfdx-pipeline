@isTest
public class OrderServiceTest {

    @isTest
    static void testGetOrderStatus_validId() {
        String status = OrderService.getOrderStatus('ORD-001');
        System.assertEquals('PENDING', status);
    }

    @isTest
    static void testGetOrderStatus_blankId_throwsException() {
        try {
            OrderService.getOrderStatus('');
            System.assert(false, 'Expected exception was not thrown');
        } catch (IllegalArgumentException e) {
            System.assertEquals('orderId cannot be blank', e.getMessage());
        }
    }

    @isTest
    static void testCalculateTotal_returnsSum() {
        List<Decimal> amounts = new List<Decimal>{ 10.0, 20.5, 5.0 };
        System.assertEquals(35.5, OrderService.calculateTotal(amounts));
    }

    @isTest
    static void testCalculateTotal_emptyList_returnsZero() {
        System.assertEquals(0, OrderService.calculateTotal(new List<Decimal>()));
    }

    @isTest
    static void testCalculateTotal_nullList_returnsZero() {
        System.assertEquals(0, OrderService.calculateTotal(null));
    }
}
