public with sharing class DummyService {
    public static String greet(String name) {
        return 'Hello, ' + name + '!';
    }

    public static String greetDefault() {
        return greet('World');
    }
}
