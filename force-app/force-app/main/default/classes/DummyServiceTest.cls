@isTest
public class DummyServiceTest {
    @isTest
    static void testGreet() {
        String result = DummyService.greet('World');
        System.assertEquals('Hello, World!', result);
    }
}
