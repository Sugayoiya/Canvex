export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Canvas Studio
          </h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            AI 驱动的分镜与视频创作工作台
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
