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

#[derive(Serialize, Deserialize, Debug, Clone, Type)]
pub struct FlagPatch {
    pub id: i64,
    pub name: Option<String>,
    pub default_value: Option<bool>,
}

#[derive(Serialize, Deserialize, Debug, Clone, Type)]
pub struct CreateFlag {
    pub story_id: i64,
    pub name: String,
    pub default_value: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone, Type)]
pub struct SetFlagOperation {
    pub choice_id: Option<i64>,
    pub page_id: Option<i64>,
    pub flag_id: i64,
    pub operation: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, Type)]
pub struct SetChoiceCondition {
    pub choice_id: i64,
    pub flag_id: i64,
    pub required_value: bool,
}
