import { useTranslation } from "../i18n";

export default () => {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-center p-8">
      <p className="text-gray-500">{t.status.loading}</p>
    </div>
  );
};
