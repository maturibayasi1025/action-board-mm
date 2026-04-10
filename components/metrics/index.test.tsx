import { fetchAllMetricsData } from "@/lib/services/metrics";
import { render } from "@testing-library/react";
import Metrics from "./index";

jest.mock("@/lib/services/metrics", () => ({
  fetchAllMetricsData: jest.fn().mockResolvedValue({
    supporter: {
      totalCount: 75982,
      last24hCount: 1710,
      updatedAt: "2025-07-03T02:20:00Z",
    },
    donation: {
      totalAmount: 1000000,
      last24hAmount: 25000,
      updatedAt: "2025-07-03T02:20:00Z",
    },
    achievement: {
      totalCount: 18605,
      todayCount: 245,
    },
    registration: {
      totalCount: 1000,
      todayCount: 50,
    },
  }),
}));

describe("Metrics", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("メトリクス取得は行うが、現状は UI を出さない", async () => {
    const { container } = render(await Metrics());

    expect(jest.mocked(fetchAllMetricsData)).toHaveBeenCalledTimes(1);
    expect(container).toBeEmptyDOMElement();
  });
});
