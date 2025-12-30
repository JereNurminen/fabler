use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("Migration error: {0}")]
    Migration(#[from] sqlx::migrate::MigrateError),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Story not found: {0}")]
    StoryNotFound(i64),

    #[error("Page not found: {0}")]
    PageNotFound(i64),

    #[error("No story currently loaded")]
    NoStoryLoaded,

    #[error("{0}")]
    Custom(String),
}

pub type AppResult<T> = Result<T, AppError>;

// Conversion for Tauri commands
impl From<AppError> for String {
    fn from(err: AppError) -> Self {
        err.to_string()
    }
}

impl From<&str> for AppError {
    fn from(msg: &str) -> Self {
        AppError::Custom(msg.to_string())
    }
}
