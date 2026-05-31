import OSLog

// Shared OSLog subsystem so the extension's lifecycle can be watched in
// Console.app / `log stream`:
//
//   log stream --predicate 'subsystem == "com.livingart.screensaver.app"' --level debug
//
enum LartLog {
    static func logger(_ category: String) -> Logger {
        Logger(subsystem: "com.livingart.screensaver.app", category: category)
    }
}
