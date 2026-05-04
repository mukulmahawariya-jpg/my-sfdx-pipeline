@isTest
public class HelloWorldTest {
    @isTest
    static void testConstructor() {
        HelloWorld hw = new HelloWorld();
        System.assertNotEquals(null, hw);
    }
}
