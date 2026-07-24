pub fn log_backend(message: &str) {
    #[cfg(debug_assertions)]
    {
        println!("[backend] {message}");
    }
}
