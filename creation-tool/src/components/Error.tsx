import { useTranslation } from "../i18n";

export default ({ error }: { error: any }) => {
  const { t } = useTranslation();
  return <p>{t.dynamic.errorMessage(error.toString())}</p>;
};
