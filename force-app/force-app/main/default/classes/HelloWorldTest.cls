@IsTest
private class HelloWorldTest {
    @IsTest
    static void testConstructor() {
        Test.startTest();
        HelloWorld hw = new HelloWorld();
        Test.stopTest();
        System.assertNotEquals(null, hw);
    }
}
