import OSLog

// Watch with:
//
//   log stream --predicate 'subsystem == "com.livingart.screensaver.app"' --level debug
//
enum LartLog {
    static func logger(_ category: String) -> Logger {
        Logger(subsystem: "com.livingart.screensaver.app", category: category)
    }
}
