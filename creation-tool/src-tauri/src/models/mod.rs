use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Serialize, Deserialize, Debug, Clone, Type)]
pub struct PagePatch {
    pub id: i64,
    pub name: Option<String>,
    pub body: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone, Type)]
pub struct ChoicePatch {
    pub id: i64,
    pub text: Option<String>,
    pub target_page: Option<i64>,
}

#[derive(Serialize, Deserialize, Debug, Clone, Type)]
pub struct StoryPatch {
    pub id: i64,
    pub title: Option<String>,
    pub start_page: Option<i64>,
}
