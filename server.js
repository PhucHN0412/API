require("dotenv").config();
const express = require("express");
const hanetService = require("./hanetService");
const getAllPlace = require("./getPlaceId");
const getDeviceById = require("./getDeviceByPlaceId");
const hanetServiceId = require("./hanetServiceId");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3001;

// Thay đổi dòng 11-12 thành:
app.use(
  cors({
    origin: [
      "https://client-i1vo1qjv7-fugboizzs-projects.vercel.app",
      "https://build-beta-nine.vercel.app", // Thêm domain này
      "http://localhost:3000",
      "*", // Hoặc sử dụng * để cho phép tất cả domain (không nên dùng trong production)
    ],
  })
);
app.use(express.json());

// Middleware logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - ${
        res.statusCode
      } (${duration}ms)`
    );
  });
  next();
});

// 2. Health check route
app.get("/api", (req, res) => {
  res.send("API Server is running!");
});

// 3. API Routes
app.get("/api/people", async (req, res, next) => {
  try {
    const peopleData = await hanetService.getPeopleListByPlace();
    res.status(200).json({ success: true, data: peopleData });
  } catch (error) {
    next(error);
  }
});

app.get("/api/place", async (req, res, next) => {
  try {
    const placeData = await getAllPlace.getAllPlace();
    res.status(200).json({ success: true, data: placeData });
  } catch (error) {
    next(error);
  }
});

app.get("/api/device", async (req, res, next) => {
  try {
    const placeId = req.query.placeId;
    if (!placeId) {
      return res.status(400).json({
        success: false,
        message: "Thiếu tham số bắt buộc: placeId",
      });
    }

    const deviceData = await getDeviceById.getDeviceById(placeId);
    res.status(200).json({ success: true, data: deviceData });
  } catch (error) {
    next(error);
  }
});

// Middleware kiểm tra tham số cho route checkins
const validateCheckinParams = (req, res, next) => {
  const { placeId, dateFrom, dateTo } = req.query;

  if (!placeId) {
    return res.status(400).json({
      success: false,
      message: "Thiếu tham số bắt buộc: placeId",
    });
  }

  if (!dateFrom) {
    return res.status(400).json({
      success: false,
      message: "Thiếu tham số bắt buộc: dateFrom",
    });
  }

  if (!dateTo) {
    return res.status(400).json({
      success: false,
      message: "Thiếu tham số bắt buộc: dateTo",
    });
  }

  const fromTimestamp = parseInt(dateFrom, 10);
  const toTimestamp = parseInt(dateTo, 10);

  if (isNaN(fromTimestamp) || isNaN(toTimestamp)) {
    return res.status(400).json({
      success: false,
      message: "dateFrom và dateTo phải là millisecond timestamp hợp lệ.",
    });
  }

  if (fromTimestamp > toTimestamp) {
    return res.status(400).json({
      success: false,
      message: "Thời gian bắt đầu không được muộn hơn thời gian kết thúc.",
    });
  }

  // Lưu timestamp đã được validate vào request object
  req.validatedParams = {
    placeId,
    fromTimestamp,
    toTimestamp,
    devices: req.query.devices,
  };

  next();
};

app.get("/api/checkins", validateCheckinParams, async (req, res, next) => {
  try {
    const { placeId, fromTimestamp, toTimestamp, devices } =
      req.validatedParams;

    console.log(
      `[${new Date().toISOString()}] Nhận yêu cầu lấy checkin cho placeId: ${placeId}, từ: ${fromTimestamp}, đến: ${toTimestamp}, devices: ${
        devices || "Tất cả"
      }`
    );

    const filteredCheckins = await hanetServiceId.getPeopleListByMethod(
      placeId,
      fromTimestamp,
      toTimestamp,
      devices
    );

    console.log(
      `[${new Date().toISOString()}] Trả về ${
        Array.isArray(filteredCheckins) ? filteredCheckins.length : "kết quả"
      } checkin.`
    );

    res.status(200).json(filteredCheckins);
  } catch (err) {
    next(err);
  }
});

// 4. Error Handling Middleware
const handleApiError = (err, req, res, next) => {
  console.error(`Lỗi trong route ${req.path}:`, err.message);
  console.error(err.stack);

  if (err.message && err.message.startsWith("HANET Error 401")) {
    return res.status(401).json({
      success: false,
      message: "Lỗi xác thực với HANET API",
    });
  }

  if (err.message && err.message.includes("place not found")) {
    return res.status(404).json({
      success: false,
      message: "Không tìm thấy địa điểm",
    });
  }

  if (err.message && err.message.startsWith("HANET API Error")) {
    return res.status(502).json({
      success: false,
      message: "Lỗi từ HANET API khi lấy dữ liệu",
      error: process.env.NODE_ENV === "production" ? undefined : err.message,
    });
  }

  res.status(500).json({
    success: false,
    message: "Lỗi máy chủ nội bộ",
    error: process.env.NODE_ENV === "production" ? undefined : err.message,
  });
};

app.use(handleApiError);

app.listen(PORT, () => {
  console.log(`Server đang lắng nghe trên cổng ${PORT}`);
  console.log(`Truy cập tại: http://localhost:${PORT}`);
});

module.exports = app;
