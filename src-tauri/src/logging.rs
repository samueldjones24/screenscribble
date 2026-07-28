pub fn log_backend(_message: &str) {
    #[cfg(debug_assertions)]
    {
        println!("[backend] {_message}");
    }
}
