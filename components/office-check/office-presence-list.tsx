import { formatRemainingNames } from "@/lib/office-check/remaining";

type Props = {
  names: string[];
};

export function OfficePresenceList({ names }: Props) {
  return (
    <p className="text-base">
      {names.length > 0 ? formatRemainingNames(names) : "なし（在室者なし）"}
    </p>
  );
}
