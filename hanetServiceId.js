function filterValidUniqueCheckins(checkinData) {
  if (!Array.isArray(checkinData)) {
    console.error("Dữ liệu đầu vào không phải là một mảng!");
    return [];
  }
  const validCheckins = checkinData.filter((checkin) => {
    return checkin && checkin.personName && checkin.personID;
  });
  const uniqueCheckins = [];
  const seenPersonIDs = new Set();
  for (const checkin of validCheckins) {
    if (!seenPersonIDs.has(checkin.personID)) {
      seenPersonIDs.add(checkin.personID);
      const selectedData = {
        personName: checkin.personName !== undefined ? checkin.personName : "",
        personID: checkin.personID,
        aliasID: checkin.aliasID !== undefined ? checkin.aliasID : "",
        placeID: checkin.placeID !== undefined ? checkin.placeID : null,
        title: checkin.title
          ? typeof checkin.title === "string"
            ? checkin.title.trim()
            : "N/A"
          : "Khách hàng",
        type: checkin.type !== undefined ? checkin.type : null,
        deviceID: checkin.deviceID !== undefined ? checkin.deviceID : "",
        deviceName: checkin.deviceName !== undefined ? checkin.deviceName : "",
        checkinTime:
          checkin.checkinTime !== undefined ? checkin.checkinTime : null,
      };
      uniqueCheckins.push(selectedData);
    }
  }
  return uniqueCheckins;
}

require("dotenv").config();
const axios = require("axios");
const qs = require("qs");
const tokenManager = require("./tokenManager");
const HANET_API_BASE_URL = process.env.HANET_API_BASE_URL;

if (!HANET_API_BASE_URL) {
  console.error("Lỗi: Biến môi trường HANET_API_BASE_URL chưa được thiết lập.");
}
async function getPeopleListByMethod(placeId, dateFrom, dateTo, devices) {
  let accessToken;
  try {
    accessToken = await tokenManager.getValidHanetToken();
  } catch (refreshError) {
    console.error("Không thể lấy được token hợp lệ:", refreshError.message);
    throw new Error(`Lỗi xác thực với HANET: ${refreshError.message}`);
  }
  if (!accessToken) {
    throw new Error("Không lấy được Access Token hợp lệ.");
  }

  const apiUrl = `${HANET_API_BASE_URL}/person/getCheckinByPlaceIdInTimestamp`;
  const requestData = {
    token: accessToken,
    placeID: placeId,
    from: dateFrom,
    to: dateTo,
    ...(devices && { devices: devices }),
  };
  const config = {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    timeout: 15000,
  };

  let rawCheckinData = [];

  try {
    console.log(`Đang gọi HANET API cho placeID=${placeId}...`);
    const response = await axios.post(
      apiUrl,
      qs.stringify(requestData),
      config
    );
    if (response.data && typeof response.data.returnCode !== "undefined") {
      if (response.data.returnCode === 1 || response.data.returnCode === 0) {
        console.log(`Gọi HANET API thành công cho placeID=${placeId}.`);
        if (Array.isArray(response.data.data)) {
          rawCheckinData = response.data.data;
          console.log(`Nhận được ${rawCheckinData.length} bản ghi check-in.`);
        } else {
          console.warn(
            `Dữ liệu trả về cho placeID ${placeId} không phải mảng hoặc không có.`
          );
        }
      } else {
        console.error(
          `Lỗi logic từ HANET cho placeID=${placeId}: Mã lỗi ${
            response.data.returnCode
          }, Thông điệp: ${response.data.returnMessage || "N/A"}`
        );
      }
    } else {
      console.error(
        `Response không hợp lệ từ HANET cho placeID=${placeId}:`,
        response.data
      );
    }
  } catch (error) {
    if (error.code === "ECONNABORTED") {
      console.error(`Lỗi timeout khi gọi API cho placeID=${placeId}.`);
    } else {
      console.error(
        `Lỗi mạng/request khi gọi ${apiUrl} cho placeID=${placeId}:`,
        error.response?.data || error.message
      );
    }
    console.warn(
      `Không lấy được dữ liệu cho địa điểm ${placeId} do lỗi request.`
    );
  }
  return filterValidUniqueCheckins(rawCheckinData);
}

module.exports = {
  getPeopleListByMethod,
};
