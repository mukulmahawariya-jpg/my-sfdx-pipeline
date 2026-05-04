@isTest
public class HelloWorldTest {
    @isTest
    static void testConstructor() {
        HelloWorld hw = new HelloWorld();
        System.assertNotEquals(null, hw);
    }

    @isTest
    static void testSayHello() {
        System.assertEquals('Hello, World!', HelloWorld.sayHello());
    }
}
