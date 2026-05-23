interface GreetingBannerProps {
  name: string;
  date: Date;
}

// date.getHours() uses server process timezone (UTC on AWS); greeting reflects server time, not user's local time
function getTimeOfDay(date: Date): "morning" | "afternoon" | "evening" {
  const hour = date.getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

export function GreetingBanner({ name, date }: GreetingBannerProps) {
  const timeOfDay = getTimeOfDay(date);
  const formatted = date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="rounded-xl bg-indigo-600 px-6 py-4 text-white">
      <p className="text-xl font-semibold">
        Good {timeOfDay}, {name} 👋
      </p>
      <p className="mt-1 text-sm text-indigo-100">{formatted}</p>
    </div>
  );
}
