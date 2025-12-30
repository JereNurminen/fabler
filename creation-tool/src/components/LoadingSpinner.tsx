import { useTranslation } from "../i18n";

export default () => {
  const { t } = useTranslation();
  return <p>{t.status.loading}</p>;
};
