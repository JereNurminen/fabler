use thiserror::Error;

#[derive(Error, Debug)]
pub enum ReaderError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Bundle error: {0}")]
    Bundle(String),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("Story not found: {0}")]
    StoryNotFound(String),

    #[error("{0}")]
    Custom(String),
}

pub type ReaderResult<T> = Result<T, ReaderError>;

impl From<ReaderError> for String {
    fn from(err: ReaderError) -> Self {
        err.to_string()
    }
}

impl From<shared::bundle::BundleError> for ReaderError {
    fn from(err: shared::bundle::BundleError) -> Self {
        ReaderError::Bundle(err.to_string())
    }
}
