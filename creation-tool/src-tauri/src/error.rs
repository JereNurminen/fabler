use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("Bundle error: {0}")]
    Bundle(#[from] shared::bundle::BundleError),

    #[error("Page not found: {0}")]
    PageNotFound(String),

    #[error("Page is in the trash: {0}")]
    PageInTrash(String),

    #[error("A live page already uses this id: {0}")]
    PageIdInUse(String),

    #[error("Cannot export: the story has {0} structural error(s)")]
    ExportBlocked(usize),

    #[error("{0}")]
    Custom(String),
}

pub type AppResult<T> = Result<T, AppError>;

impl From<AppError> for String {
    fn from(err: AppError) -> Self {
        err.to_string()
    }
}
