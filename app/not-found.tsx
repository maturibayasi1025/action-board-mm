export const runtime = "edge";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <div className="text-center space-y-4">
        <h1 className="text-6xl font-bold text-gray-900">404</h1>
        <h2 className="text-2xl font-semibold text-gray-700">
          ページが見つかりません
        </h2>
        <p className="text-gray-600 max-w-md">
          お探しのページは存在しないか、移動した可能性があります。
        </p>
        <div className="pt-6">
          <a
            href="/"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            ホームに戻る
          </a>
        </div>
      </div>
    </div>
  );
}
