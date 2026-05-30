const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const { Client } = require('pg');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { convertPdfToJpeg } = require('../utils/converter');

const CONFIG_FILE = process.env.APP_DATA_DIR
  ? path.join(process.env.APP_DATA_DIR, 'db_config.json')
  : path.join(__dirname, '..', 'db_config.json');
const LOG_DIR = process.env.APP_DATA_DIR
  ? path.join(process.env.APP_DATA_DIR, 'logs')
  : path.join(__dirname, '..', 'logs');

// =============================================
// Year-specific configurations
// =============================================
const YEAR_CONFIGS = {
  2568: {
    label: 'ปี 2568 → opdscan',
    sourceQuery: `SELECT tbo.hn, tbo.vn,
      CONCAT(tbo.datescan, ' ', tbo.timescan) AS scan_date_time,
      tbd.pages AS pageno,
      tbd.imagescan AS scan_image,
      'JPG' AS image_type,
      tbd.doctype_id AS hos_guid,
      tbo.\`user\` AS officer,
      'N' AS check_right,
      '99' AS scan_type_id
    FROM tb_opd tbo
    INNER JOIN tb_opd_detail_2025 tbd ON tbd.vn = tbo.vn
    WHERE tbo.datescan BETWEEN ? AND ?`,
    previewQuery: `SELECT tbo.hn, tbo.vn,
      CONCAT(tbo.datescan, ' ', tbo.timescan) AS scan_date_time,
      tbd.pages AS pageno,
      IF(tbd.imagescan IS NOT NULL, 1, 0) AS has_image,
      'JPG' AS image_type,
      tbd.doctype_id AS hos_guid,
      tbo.\`user\` AS officer,
      'N' AS check_right,
      '99' AS scan_type_id
    FROM tb_opd tbo
    INNER JOIN tb_opd_detail_2025 tbd ON tbd.vn = tbo.vn
    WHERE tbo.datescan BETWEEN ? AND ?
    ORDER BY tbo.vn`,
    countQuery: `SELECT COUNT(*) AS total
    FROM tb_opd tbo
    INNER JOIN tb_opd_detail_2025 tbd ON tbd.vn = tbo.vn
    WHERE tbo.datescan BETWEEN ? AND ?`,
    targetTable: 'opdscan',
    pdfField: 'scan_image',
    idField: 'hn',
    fields: ['scan_id', 'hn', 'scan_date_time', 'pageno', 'scan_image', 'image_type', 'hos_guid', 'officer']
  },
  2567: {
    label: 'ปี 2567 → opdscan',
    sourceQuery: `SELECT tbo.hn, tbo.vn,
      CONCAT(tbo.datescan, ' ', tbo.timescan) AS scan_date_time,
      tbd.pages AS pageno,
      tbd.imagescan AS scan_image,
      'JPG' AS image_type,
      tbd.doctype_id AS hos_guid,
      tbo.\`user\` AS officer,
      'N' AS check_right,
      '99' AS scan_type_id
    FROM tb_opd tbo
    INNER JOIN tb_opd_detail_2024 tbd ON tbd.vn = tbo.vn
    WHERE tbo.datescan BETWEEN ? AND ?`,
    previewQuery: `SELECT tbo.hn, tbo.vn,
      CONCAT(tbo.datescan, ' ', tbo.timescan) AS scan_date_time,
      tbd.pages AS pageno,
      IF(tbd.imagescan IS NOT NULL, 1, 0) AS has_image,
      'JPG' AS image_type,
      tbd.doctype_id AS hos_guid,
      tbo.\`user\` AS officer,
      'N' AS check_right,
      '99' AS scan_type_id
    FROM tb_opd tbo
    INNER JOIN tb_opd_detail_2024 tbd ON tbd.vn = tbo.vn
    WHERE tbo.datescan BETWEEN ? AND ?
    ORDER BY tbo.vn`,
    countQuery: `SELECT COUNT(*) AS total
    FROM tb_opd tbo
    INNER JOIN tb_opd_detail_2024 tbd ON tbd.vn = tbo.vn
    WHERE tbo.datescan BETWEEN ? AND ?`,
    targetTable: 'opdscan',
    pdfField: 'scan_image',
    idField: 'hn',
    fields: ['scan_id', 'hn', 'scan_date_time', 'pageno', 'scan_image', 'image_type', 'hos_guid', 'officer']
  },
  2566: {
    label: 'ปี 2566 → opdscan',
    sourceQuery: `SELECT tbo.hn, tbo.vn,
      CONCAT(tbo.datescan, ' ', tbo.timescan) AS scan_date_time,
      tbd.pages AS pageno,
      tbd.imagescan AS scan_image,
      'JPG' AS image_type,
      tbd.doctype_id AS hos_guid,
      tbo.\`user\` AS officer,
      'N' AS check_right,
      '99' AS scan_type_id
    FROM tb_opd tbo
    INNER JOIN tb_opd_detail_2023 tbd ON tbd.vn = tbo.vn
    WHERE tbo.datescan BETWEEN ? AND ?`,
    previewQuery: `SELECT tbo.hn, tbo.vn,
      CONCAT(tbo.datescan, ' ', tbo.timescan) AS scan_date_time,
      tbd.pages AS pageno,
      IF(tbd.imagescan IS NOT NULL, 1, 0) AS has_image,
      'JPG' AS image_type,
      tbd.doctype_id AS hos_guid,
      tbo.\`user\` AS officer,
      'N' AS check_right,
      '99' AS scan_type_id
    FROM tb_opd tbo
    INNER JOIN tb_opd_detail_2023 tbd ON tbd.vn = tbo.vn
    WHERE tbo.datescan BETWEEN ? AND ?
    ORDER BY tbo.vn`,
    countQuery: `SELECT COUNT(*) AS total
    FROM tb_opd tbo
    INNER JOIN tb_opd_detail_2023 tbd ON tbd.vn = tbo.vn
    WHERE tbo.datescan BETWEEN ? AND ?`,
    targetTable: 'opdscan',
    pdfField: 'scan_image',
    idField: 'hn',
    fields: ['scan_id', 'hn', 'scan_date_time', 'pageno', 'scan_image', 'image_type', 'hos_guid', 'officer']
  },
  2565: {
    label: 'ปี 2565 → opdscan',
    sourceQuery: `SELECT tbo.hn, tbo.vn,
      CONCAT(tbo.datescan, ' ', tbo.timescan) AS scan_date_time,
      tbd.pages AS pageno,
      tbd.imagescan AS scan_image,
      'JPG' AS image_type,
      tbd.doctype_id AS hos_guid,
      tbo.\`user\` AS officer,
      'N' AS check_right,
      '99' AS scan_type_id
    FROM tb_opd tbo
    INNER JOIN tb_opd_detail_2022 tbd ON tbd.vn = tbo.vn
    WHERE tbo.datescan BETWEEN ? AND ?`,
    previewQuery: `SELECT tbo.hn, tbo.vn,
      CONCAT(tbo.datescan, ' ', tbo.timescan) AS scan_date_time,
      tbd.pages AS pageno,
      IF(tbd.imagescan IS NOT NULL, 1, 0) AS has_image,
      'JPG' AS image_type,
      tbd.doctype_id AS hos_guid,
      tbo.\`user\` AS officer,
      'N' AS check_right,
      '99' AS scan_type_id
    FROM tb_opd tbo
    INNER JOIN tb_opd_detail_2022 tbd ON tbd.vn = tbo.vn
    WHERE tbo.datescan BETWEEN ? AND ?
    ORDER BY tbo.vn`,
    countQuery: `SELECT COUNT(*) AS total
    FROM tb_opd tbo
    INNER JOIN tb_opd_detail_2022 tbd ON tbd.vn = tbo.vn
    WHERE tbo.datescan BETWEEN ? AND ?`,
    targetTable: 'opdscan',
    pdfField: 'scan_image',
    idField: 'hn',
    fields: ['scan_id', 'hn', 'scan_date_time', 'pageno', 'scan_image', 'image_type', 'hos_guid', 'officer']
  },
  2564: {
    label: 'ปี 2564 → opdscan',
    sourceQuery: `SELECT tbo.hn, tbo.vn,
      CONCAT(tbo.datescan, ' ', tbo.timescan) AS scan_date_time,
      tbd.pages AS pageno,
      tbd.imagescan AS scan_image,
      'JPG' AS image_type,
      tbd.doctype_id AS hos_guid,
      tbo.\`user\` AS officer,
      'N' AS check_right,
      '99' AS scan_type_id
    FROM tb_opd tbo
    INNER JOIN tb_opd_detail_2021 tbd ON tbd.vn = tbo.vn
    WHERE tbo.datescan BETWEEN ? AND ?`,
    previewQuery: `SELECT tbo.hn, tbo.vn,
      CONCAT(tbo.datescan, ' ', tbo.timescan) AS scan_date_time,
      tbd.pages AS pageno,
      IF(tbd.imagescan IS NOT NULL, 1, 0) AS has_image,
      'JPG' AS image_type,
      tbd.doctype_id AS hos_guid,
      tbo.\`user\` AS officer,
      'N' AS check_right,
      '99' AS scan_type_id
    FROM tb_opd tbo
    INNER JOIN tb_opd_detail_2021 tbd ON tbd.vn = tbo.vn
    WHERE tbo.datescan BETWEEN ? AND ?
    ORDER BY tbo.vn`,
    countQuery: `SELECT COUNT(*) AS total
    FROM tb_opd tbo
    INNER JOIN tb_opd_detail_2021 tbd ON tbd.vn = tbo.vn
    WHERE tbo.datescan BETWEEN ? AND ?`,
    targetTable: 'opdscan',
    pdfField: 'scan_image',
    idField: 'hn',
    fields: ['scan_id', 'hn', 'scan_date_time', 'pageno', 'scan_image', 'image_type', 'hos_guid', 'officer']
  },
  2563: {
    label: 'ปี 2563 → opdscan',
    sourceQuery: `SELECT tbo.hn, tbo.vn,
      CONCAT(tbo.datescan, ' ', tbo.timescan) AS scan_date_time,
      tbd.pages AS pageno,
      tbd.imagescan AS scan_image,
      'JPG' AS image_type,
      tbd.doctype_id AS hos_guid,
      tbo.\`user\` AS officer,
      'N' AS check_right,
      '99' AS scan_type_id
    FROM tb_opd tbo
    INNER JOIN tb_opd_detail_2020 tbd ON tbd.vn = tbo.vn
    WHERE tbo.datescan BETWEEN ? AND ?`,
    previewQuery: `SELECT tbo.hn, tbo.vn,
      CONCAT(tbo.datescan, ' ', tbo.timescan) AS scan_date_time,
      tbd.pages AS pageno,
      IF(tbd.imagescan IS NOT NULL, 1, 0) AS has_image,
      'JPG' AS image_type,
      tbd.doctype_id AS hos_guid,
      tbo.\`user\` AS officer,
      'N' AS check_right,
      '99' AS scan_type_id
    FROM tb_opd tbo
    INNER JOIN tb_opd_detail_2020 tbd ON tbd.vn = tbo.vn
    WHERE tbo.datescan BETWEEN ? AND ?
    ORDER BY tbo.vn`,
    countQuery: `SELECT COUNT(*) AS total
    FROM tb_opd tbo
    INNER JOIN tb_opd_detail_2020 tbd ON tbd.vn = tbo.vn
    WHERE tbo.datescan BETWEEN ? AND ?`,
    targetTable: 'opdscan',
    pdfField: 'scan_image',
    idField: 'hn',
    fields: ['scan_id', 'hn', 'scan_date_time', 'pageno', 'scan_image', 'image_type', 'hos_guid', 'officer']
  },
  2562: {
    label: 'ปี 2562 → opdscan',
    sourceQuery: `SELECT tbo.hn, tbo.vn,
      CONCAT(tbo.datescan, ' ', tbo.timescan) AS scan_date_time,
      tbd.pages AS pageno,
      tbd.imagescan AS scan_image,
      'JPG' AS image_type,
      tbd.doctype_id AS hos_guid,
      tbo.\`user\` AS officer,
      'N' AS check_right,
      '99' AS scan_type_id
    FROM tb_opd tbo
    INNER JOIN tb_opd_detail_2019 tbd ON tbd.vn = tbo.vn
    WHERE tbo.datescan BETWEEN ? AND ?`,
    previewQuery: `SELECT tbo.hn, tbo.vn,
      CONCAT(tbo.datescan, ' ', tbo.timescan) AS scan_date_time,
      tbd.pages AS pageno,
      IF(tbd.imagescan IS NOT NULL, 1, 0) AS has_image,
      'JPG' AS image_type,
      tbd.doctype_id AS hos_guid,
      tbo.\`user\` AS officer,
      'N' AS check_right,
      '99' AS scan_type_id
    FROM tb_opd tbo
    INNER JOIN tb_opd_detail_2019 tbd ON tbd.vn = tbo.vn
    WHERE tbo.datescan BETWEEN ? AND ?
    ORDER BY tbo.vn`,
    countQuery: `SELECT COUNT(*) AS total
    FROM tb_opd tbo
    INNER JOIN tb_opd_detail_2019 tbd ON tbd.vn = tbo.vn
    WHERE tbo.datescan BETWEEN ? AND ?`,
    targetTable: 'opdscan',
    pdfField: 'scan_image',
    idField: 'hn',
    fields: ['scan_id', 'hn', 'scan_date_time', 'pageno', 'scan_image', 'image_type', 'hos_guid', 'officer']
  },
  2561: {
    label: 'ปี 2561 → opdscan',
    sourceQuery: `SELECT tbo.hn, tbo.vn,
      CONCAT(tbo.datescan, ' ', tbo.timescan) AS scan_date_time,
      tbd.pages AS pageno,
      tbd.imagescan AS scan_image,
      'JPG' AS image_type,
      tbd.doctype_id AS hos_guid,
      tbo.\`user\` AS officer,
      'N' AS check_right,
      '99' AS scan_type_id
    FROM tb_opd tbo
    INNER JOIN tb_opd_detail_2018 tbd ON tbd.vn = tbo.vn
    WHERE tbo.datescan BETWEEN ? AND ?`,
    previewQuery: `SELECT tbo.hn, tbo.vn,
      CONCAT(tbo.datescan, ' ', tbo.timescan) AS scan_date_time,
      tbd.pages AS pageno,
      IF(tbd.imagescan IS NOT NULL, 1, 0) AS has_image,
      'JPG' AS image_type,
      tbd.doctype_id AS hos_guid,
      tbo.\`user\` AS officer,
      'N' AS check_right,
      '99' AS scan_type_id
    FROM tb_opd tbo
    INNER JOIN tb_opd_detail_2018 tbd ON tbd.vn = tbo.vn
    WHERE tbo.datescan BETWEEN ? AND ?
    ORDER BY tbo.vn`,
    countQuery: `SELECT COUNT(*) AS total
    FROM tb_opd tbo
    INNER JOIN tb_opd_detail_2018 tbd ON tbd.vn = tbo.vn
    WHERE tbo.datescan BETWEEN ? AND ?`,
    targetTable: 'opdscan',
    pdfField: 'scan_image',
    idField: 'hn',
    fields: ['scan_id', 'hn', 'scan_date_time', 'pageno', 'scan_image', 'image_type', 'hos_guid', 'officer']
  },
  2560: {
    label: 'ปี 2560 → opdscan',
    sourceQuery: `SELECT tbo.hn, tbo.vn,
      CONCAT(tbo.datescan, ' ', tbo.timescan) AS scan_date_time,
      tbd.pages AS pageno,
      tbd.imagescan AS scan_image,
      'JPG' AS image_type,
      tbd.doctype_id AS hos_guid,
      tbo.\`user\` AS officer,
      'N' AS check_right,
      '99' AS scan_type_id
    FROM tb_opd tbo
    INNER JOIN tb_opd_detail_2017 tbd ON tbd.vn = tbo.vn
    WHERE tbo.datescan BETWEEN ? AND ?`,
    previewQuery: `SELECT tbo.hn, tbo.vn,
      CONCAT(tbo.datescan, ' ', tbo.timescan) AS scan_date_time,
      tbd.pages AS pageno,
      IF(tbd.imagescan IS NOT NULL, 1, 0) AS has_image,
      'JPG' AS image_type,
      tbd.doctype_id AS hos_guid,
      tbo.\`user\` AS officer,
      'N' AS check_right,
      '99' AS scan_type_id
    FROM tb_opd tbo
    INNER JOIN tb_opd_detail_2017 tbd ON tbd.vn = tbo.vn
    WHERE tbo.datescan BETWEEN ? AND ?
    ORDER BY tbo.vn`,
    countQuery: `SELECT COUNT(*) AS total
    FROM tb_opd tbo
    INNER JOIN tb_opd_detail_2017 tbd ON tbd.vn = tbo.vn
    WHERE tbo.datescan BETWEEN ? AND ?`,
    targetTable: 'opdscan',
    pdfField: 'scan_image',
    idField: 'hn',
    fields: ['scan_id', 'hn', 'scan_date_time', 'pageno', 'scan_image', 'image_type', 'hos_guid', 'officer']
  },
  2569: {
    label: 'ปี 2569 → opdscan',
    sourceQuery: `SELECT tbo.hn, tbo.vn,
      CONCAT(tbo.datescan, ' ', tbo.timescan) AS scan_date_time,
      tbd.pages AS pageno,
      tbd.imagescan AS scan_image,
      'JPG' AS image_type,
      tbd.doctype_id AS hos_guid,
      tbo.\`user\` AS officer,
      'N' AS check_right,
      '99' AS scan_type_id
    FROM tb_opd tbo
    INNER JOIN tb_opd_detail_2026 tbd ON tbd.vn = tbo.vn
    WHERE tbo.datescan BETWEEN ? AND ?`,
    previewQuery: `SELECT tbo.hn, tbo.vn,
      CONCAT(tbo.datescan, ' ', tbo.timescan) AS scan_date_time,
      tbd.pages AS pageno,
      IF(tbd.imagescan IS NOT NULL, 1, 0) AS has_image,
      'JPG' AS image_type,
      tbd.doctype_id AS hos_guid,
      tbo.\`user\` AS officer,
      'N' AS check_right,
      '99' AS scan_type_id
    FROM tb_opd tbo
    INNER JOIN tb_opd_detail_2026 tbd ON tbd.vn = tbo.vn
    WHERE tbo.datescan BETWEEN ? AND ?
    ORDER BY tbo.vn`,
    countQuery: `SELECT COUNT(*) AS total
    FROM tb_opd tbo
    INNER JOIN tb_opd_detail_2026 tbd ON tbd.vn = tbo.vn
    WHERE tbo.datescan BETWEEN ? AND ?`,
    targetTable: 'opdscan',
    pdfField: 'scan_image',
    idField: 'hn',
    fields: ['scan_id', 'hn', 'scan_date_time', 'pageno', 'scan_image', 'image_type', 'hos_guid', 'officer']
  },
  '2568-06': {
    label: 'ปี 2568 เดือน มิ.ย. → opdscan',
    sourceQuery: `SELECT tbo.hn, tbo.vn,
      CONCAT(tbo.datescan, ' ', tbo.timescan) AS scan_date_time,
      tbd.pages AS pageno,
      tbd.imagescan AS scan_image,
      'JPG' AS image_type,
      tbd.doctype_id AS hos_guid,
      tbo.\`user\` AS officer,
      'N' AS check_right,
      '99' AS scan_type_id
    FROM tb_opd tbo
    INNER JOIN tb_opd_detail_202506 tbd ON tbd.vn = tbo.vn
    WHERE tbo.datescan BETWEEN ? AND ?`,
    previewQuery: `SELECT tbo.hn, tbo.vn,
      CONCAT(tbo.datescan, ' ', tbo.timescan) AS scan_date_time,
      tbd.pages AS pageno,
      IF(tbd.imagescan IS NOT NULL, 1, 0) AS has_image,
      'JPG' AS image_type,
      tbd.doctype_id AS hos_guid,
      tbo.\`user\` AS officer,
      'N' AS check_right,
      '99' AS scan_type_id
    FROM tb_opd tbo
    INNER JOIN tb_opd_detail_202506 tbd ON tbd.vn = tbo.vn
    WHERE tbo.datescan BETWEEN ? AND ?
    ORDER BY tbo.vn`,
    countQuery: `SELECT COUNT(*) AS total
    FROM tb_opd tbo
    INNER JOIN tb_opd_detail_202506 tbd ON tbd.vn = tbo.vn
    WHERE tbo.datescan BETWEEN ? AND ?`,
    targetTable: 'opdscan',
    pdfField: 'scan_image',
    idField: 'hn',
    fields: ['scan_id', 'hn', 'scan_date_time', 'pageno', 'scan_image', 'image_type', 'hos_guid', 'officer']
  },
  '2568-10': {
    label: 'ปี 2568 เดือน ต.ค. → opdscan',
    sourceQuery: `SELECT tbo.hn, tbo.vn,
      CONCAT(tbo.datescan, ' ', tbo.timescan) AS scan_date_time,
      tbd.pages AS pageno,
      tbd.imagescan AS scan_image,
      'JPG' AS image_type,
      tbd.doctype_id AS hos_guid,
      tbo.\`user\` AS officer,
      'N' AS check_right,
      '99' AS scan_type_id
    FROM tb_opd tbo
    INNER JOIN tb_opd_detail_202510 tbd ON tbd.vn = tbo.vn
    WHERE tbo.datescan BETWEEN ? AND ?`,
    previewQuery: `SELECT tbo.hn, tbo.vn,
      CONCAT(tbo.datescan, ' ', tbo.timescan) AS scan_date_time,
      tbd.pages AS pageno,
      IF(tbd.imagescan IS NOT NULL, 1, 0) AS has_image,
      'JPG' AS image_type,
      tbd.doctype_id AS hos_guid,
      tbo.\`user\` AS officer,
      'N' AS check_right,
      '99' AS scan_type_id
    FROM tb_opd tbo
    INNER JOIN tb_opd_detail_202510 tbd ON tbd.vn = tbo.vn
    WHERE tbo.datescan BETWEEN ? AND ?
    ORDER BY tbo.vn`,
    countQuery: `SELECT COUNT(*) AS total
    FROM tb_opd tbo
    INNER JOIN tb_opd_detail_202510 tbd ON tbd.vn = tbo.vn
    WHERE tbo.datescan BETWEEN ? AND ?`,
    targetTable: 'opdscan',
    pdfField: 'scan_image',
    idField: 'hn',
    fields: ['scan_id', 'hn', 'scan_date_time', 'pageno', 'scan_image', 'image_type', 'hos_guid', 'officer']
  },
  '2568-11': {
    label: 'ปี 2568 เดือน พ.ย. → opdscan',
    sourceQuery: `SELECT tbo.hn, tbo.vn,
      CONCAT(tbo.datescan, ' ', tbo.timescan) AS scan_date_time,
      tbd.pages AS pageno,
      tbd.imagescan AS scan_image,
      'JPG' AS image_type,
      tbd.doctype_id AS hos_guid,
      tbo.\`user\` AS officer,
      'N' AS check_right,
      '99' AS scan_type_id
    FROM tb_opd tbo
    INNER JOIN tb_opd_detail_202511 tbd ON tbd.vn = tbo.vn
    WHERE tbo.datescan BETWEEN ? AND ?`,
    previewQuery: `SELECT tbo.hn, tbo.vn,
      CONCAT(tbo.datescan, ' ', tbo.timescan) AS scan_date_time,
      tbd.pages AS pageno,
      IF(tbd.imagescan IS NOT NULL, 1, 0) AS has_image,
      'JPG' AS image_type,
      tbd.doctype_id AS hos_guid,
      tbo.\`user\` AS officer,
      'N' AS check_right,
      '99' AS scan_type_id
    FROM tb_opd tbo
    INNER JOIN tb_opd_detail_202511 tbd ON tbd.vn = tbo.vn
    WHERE tbo.datescan BETWEEN ? AND ?
    ORDER BY tbo.vn`,
    countQuery: `SELECT COUNT(*) AS total
    FROM tb_opd tbo
    INNER JOIN tb_opd_detail_202511 tbd ON tbd.vn = tbo.vn
    WHERE tbo.datescan BETWEEN ? AND ?`,
    targetTable: 'opdscan',
    pdfField: 'scan_image',
    idField: 'hn',
    fields: ['scan_id', 'hn', 'scan_date_time', 'pageno', 'scan_image', 'image_type', 'hos_guid', 'officer']
  },
  '2568-12': {
    label: 'ปี 2568 เดือน ธ.ค. → opdscan',
    sourceQuery: `SELECT tbo.hn, tbo.vn,
      CONCAT(tbo.datescan, ' ', tbo.timescan) AS scan_date_time,
      tbd.pages AS pageno,
      tbd.imagescan AS scan_image,
      'JPG' AS image_type,
      tbd.doctype_id AS hos_guid,
      tbo.\`user\` AS officer,
      'N' AS check_right,
      '99' AS scan_type_id
    FROM tb_opd tbo
    INNER JOIN tb_opd_detail_202512 tbd ON tbd.vn = tbo.vn
    WHERE tbo.datescan BETWEEN ? AND ?`,
    previewQuery: `SELECT tbo.hn, tbo.vn,
      CONCAT(tbo.datescan, ' ', tbo.timescan) AS scan_date_time,
      tbd.pages AS pageno,
      IF(tbd.imagescan IS NOT NULL, 1, 0) AS has_image,
      'JPG' AS image_type,
      tbd.doctype_id AS hos_guid,
      tbo.\`user\` AS officer,
      'N' AS check_right,
      '99' AS scan_type_id
    FROM tb_opd tbo
    INNER JOIN tb_opd_detail_202512 tbd ON tbd.vn = tbo.vn
    WHERE tbo.datescan BETWEEN ? AND ?
    ORDER BY tbo.vn`,
    countQuery: `SELECT COUNT(*) AS total
    FROM tb_opd tbo
    INNER JOIN tb_opd_detail_202512 tbd ON tbd.vn = tbo.vn
    WHERE tbo.datescan BETWEEN ? AND ?`,
    targetTable: 'opdscan',
    pdfField: 'scan_image',
    idField: 'hn',
    fields: ['scan_id', 'hn', 'scan_date_time', 'pageno', 'scan_image', 'image_type', 'hos_guid', 'officer']
  },
  '2569-01': {
    label: 'ปี 2569 เดือน ม.ค. → opdscan',
    sourceQuery: `SELECT tbo.hn, tbo.vn,
      CONCAT(tbo.datescan, ' ', tbo.timescan) AS scan_date_time,
      tbd.pages AS pageno,
      tbd.imagescan AS scan_image,
      'JPG' AS image_type,
      tbd.doctype_id AS hos_guid,
      tbo.\`user\` AS officer,
      'N' AS check_right,
      '99' AS scan_type_id
    FROM tb_opd tbo
    INNER JOIN tb_opd_detail_202601 tbd ON tbd.vn = tbo.vn
    WHERE tbo.datescan BETWEEN ? AND ?`,
    previewQuery: `SELECT tbo.hn, tbo.vn,
      CONCAT(tbo.datescan, ' ', tbo.timescan) AS scan_date_time,
      tbd.pages AS pageno,
      IF(tbd.imagescan IS NOT NULL, 1, 0) AS has_image,
      'JPG' AS image_type,
      tbd.doctype_id AS hos_guid,
      tbo.\`user\` AS officer,
      'N' AS check_right,
      '99' AS scan_type_id
    FROM tb_opd tbo
    INNER JOIN tb_opd_detail_202601 tbd ON tbd.vn = tbo.vn
    WHERE tbo.datescan BETWEEN ? AND ?
    ORDER BY tbo.vn`,
    countQuery: `SELECT COUNT(*) AS total
    FROM tb_opd tbo
    INNER JOIN tb_opd_detail_202601 tbd ON tbd.vn = tbo.vn
    WHERE tbo.datescan BETWEEN ? AND ?`,
    targetTable: 'opdscan',
    pdfField: 'scan_image',
    idField: 'hn',
    fields: ['scan_id', 'hn', 'scan_date_time', 'pageno', 'scan_image', 'image_type', 'hos_guid', 'officer']
  },
  '2569-02': {
    label: 'ปี 2569 เดือน ก.พ. → opdscan',
    sourceQuery: `SELECT tbo.hn, tbo.vn,
      CONCAT(tbo.datescan, ' ', tbo.timescan) AS scan_date_time,
      tbd.pages AS pageno,
      tbd.imagescan AS scan_image,
      'JPG' AS image_type,
      tbd.doctype_id AS hos_guid,
      tbo.\`user\` AS officer,
      'N' AS check_right,
      '99' AS scan_type_id
    FROM tb_opd tbo
    INNER JOIN tb_opd_detail_202602 tbd ON tbd.vn = tbo.vn
    WHERE tbo.datescan BETWEEN ? AND ?`,
    previewQuery: `SELECT tbo.hn, tbo.vn,
      CONCAT(tbo.datescan, ' ', tbo.timescan) AS scan_date_time,
      tbd.pages AS pageno,
      IF(tbd.imagescan IS NOT NULL, 1, 0) AS has_image,
      'JPG' AS image_type,
      tbd.doctype_id AS hos_guid,
      tbo.\`user\` AS officer,
      'N' AS check_right,
      '99' AS scan_type_id
    FROM tb_opd tbo
    INNER JOIN tb_opd_detail_202602 tbd ON tbd.vn = tbo.vn
    WHERE tbo.datescan BETWEEN ? AND ?
    ORDER BY tbo.vn`,
    countQuery: `SELECT COUNT(*) AS total
    FROM tb_opd tbo
    INNER JOIN tb_opd_detail_202602 tbd ON tbd.vn = tbo.vn
    WHERE tbo.datescan BETWEEN ? AND ?`,
    targetTable: 'opdscan',
    pdfField: 'scan_image',
    idField: 'hn',
    fields: ['scan_id', 'hn', 'scan_date_time', 'pageno', 'scan_image', 'image_type', 'hos_guid', 'officer']
  },
  '2569-03': {
    label: 'ปี 2569 เดือน มี.ค. → opdscan',
    sourceQuery: `SELECT tbo.hn, tbo.vn,
      CONCAT(tbo.datescan, ' ', tbo.timescan) AS scan_date_time,
      tbd.pages AS pageno,
      tbd.imagescan AS scan_image,
      'JPG' AS image_type,
      tbd.doctype_id AS hos_guid,
      tbo.\`user\` AS officer,
      'N' AS check_right,
      '99' AS scan_type_id
    FROM tb_opd tbo
    INNER JOIN tb_opd_detail_202603 tbd ON tbd.vn = tbo.vn
    WHERE tbo.datescan BETWEEN ? AND ?`,
    previewQuery: `SELECT tbo.hn, tbo.vn,
      CONCAT(tbo.datescan, ' ', tbo.timescan) AS scan_date_time,
      tbd.pages AS pageno,
      IF(tbd.imagescan IS NOT NULL, 1, 0) AS has_image,
      'JPG' AS image_type,
      tbd.doctype_id AS hos_guid,
      tbo.\`user\` AS officer,
      'N' AS check_right,
      '99' AS scan_type_id
    FROM tb_opd tbo
    INNER JOIN tb_opd_detail_202603 tbd ON tbd.vn = tbo.vn
    WHERE tbo.datescan BETWEEN ? AND ?
    ORDER BY tbo.vn`,
    countQuery: `SELECT COUNT(*) AS total
    FROM tb_opd tbo
    INNER JOIN tb_opd_detail_202603 tbd ON tbd.vn = tbo.vn
    WHERE tbo.datescan BETWEEN ? AND ?`,
    targetTable: 'opdscan',
    pdfField: 'scan_image',
    idField: 'hn',
    fields: ['scan_id', 'hn', 'scan_date_time', 'pageno', 'scan_image', 'image_type', 'hos_guid', 'officer']
  },
  '2569-04': {
    label: 'ปี 2569 เดือน เม.ย. → opdscan',
    sourceQuery: `SELECT tbo.hn, tbo.vn,
      CONCAT(tbo.datescan, ' ', tbo.timescan) AS scan_date_time,
      tbd.pages AS pageno,
      tbd.imagescan AS scan_image,
      'JPG' AS image_type,
      tbd.doctype_id AS hos_guid,
      tbo.\`user\` AS officer,
      'N' AS check_right,
      '99' AS scan_type_id
    FROM tb_opd tbo
    INNER JOIN tb_opd_detail_202604 tbd ON tbd.vn = tbo.vn
    WHERE tbo.datescan BETWEEN ? AND ?`,
    previewQuery: `SELECT tbo.hn, tbo.vn,
      CONCAT(tbo.datescan, ' ', tbo.timescan) AS scan_date_time,
      tbd.pages AS pageno,
      IF(tbd.imagescan IS NOT NULL, 1, 0) AS has_image,
      'JPG' AS image_type,
      tbd.doctype_id AS hos_guid,
      tbo.\`user\` AS officer,
      'N' AS check_right,
      '99' AS scan_type_id
    FROM tb_opd tbo
    INNER JOIN tb_opd_detail_202604 tbd ON tbd.vn = tbo.vn
    WHERE tbo.datescan BETWEEN ? AND ?
    ORDER BY tbo.vn`,
    countQuery: `SELECT COUNT(*) AS total
    FROM tb_opd tbo
    INNER JOIN tb_opd_detail_202604 tbd ON tbd.vn = tbo.vn
    WHERE tbo.datescan BETWEEN ? AND ?`,
    targetTable: 'opdscan',
    pdfField: 'scan_image',
    idField: 'hn',
    fields: ['scan_id', 'hn', 'scan_date_time', 'pageno', 'scan_image', 'image_type', 'hos_guid', 'officer']
  },
  '2569-05': {
    label: 'ปี 2569 เดือน พ.ค. → opdscan',
    sourceQuery: `SELECT tbo.hn, tbo.vn,
      CONCAT(tbo.datescan, ' ', tbo.timescan) AS scan_date_time,
      tbd.pages AS pageno,
      tbd.imagescan AS scan_image,
      'JPG' AS image_type,
      tbd.doctype_id AS hos_guid,
      tbo.\`user\` AS officer,
      'N' AS check_right,
      '99' AS scan_type_id
    FROM tb_opd tbo
    INNER JOIN tb_opd_detail_202605 tbd ON tbd.vn = tbo.vn
    WHERE tbo.datescan BETWEEN ? AND ?`,
    previewQuery: `SELECT tbo.hn, tbo.vn,
      CONCAT(tbo.datescan, ' ', tbo.timescan) AS scan_date_time,
      tbd.pages AS pageno,
      IF(tbd.imagescan IS NOT NULL, 1, 0) AS has_image,
      'JPG' AS image_type,
      tbd.doctype_id AS hos_guid,
      tbo.\`user\` AS officer,
      'N' AS check_right,
      '99' AS scan_type_id
    FROM tb_opd tbo
    INNER JOIN tb_opd_detail_202605 tbd ON tbd.vn = tbo.vn
    WHERE tbo.datescan BETWEEN ? AND ?
    ORDER BY tbo.vn`,
    countQuery: `SELECT COUNT(*) AS total
    FROM tb_opd tbo
    INNER JOIN tb_opd_detail_202605 tbd ON tbd.vn = tbo.vn
    WHERE tbo.datescan BETWEEN ? AND ?`,
    targetTable: 'opdscan',
    pdfField: 'scan_image',
    idField: 'hn',
    fields: ['scan_id', 'hn', 'scan_date_time', 'pageno', 'scan_image', 'image_type', 'hos_guid', 'officer']
  }
};

// =============================================
// Helpers
// =============================================
function loadConfig() {
  if (fs.existsSync(CONFIG_FILE)) {
    try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch (e) {}
  }
  return { source: {}, target: {}, yearQueries: {} };
}

async function createSourceConn(cfg) {
  return mysql.createConnection({
    host: cfg.host,
    port: parseInt(cfg.port) || 3306,
    database: cfg.database,
    user: cfg.user,
    password: cfg.password,
    supportBigNumbers: true
  });
}

async function createTargetConn(cfg) {
  if (cfg.dbType === 'postgresql') {
    const client = new Client({
      host: cfg.host,
      port: parseInt(cfg.port) || 5432,
      database: cfg.database,
      user: cfg.user,
      password: cfg.password
    });
    await client.connect();
    client._dbType = 'pg';
    return client;
  }
  const conn = await mysql.createConnection({
    host: cfg.host,
    port: parseInt(cfg.port) || 3306,
    database: cfg.database,
    user: cfg.user,
    password: cfg.password,
    supportBigNumbers: true
  });
  conn._dbType = 'mysql';
  return conn;
}

// ดึง MAX(scan_id) จาก target แล้วเริ่ม counter ที่ MAX+1
async function resolveSerialMode(conn, tableName, isPg) {
  try {
    if (isPg) {
      const r = await conn.query(`SELECT COALESCE(MAX(scan_id), 0) AS mx FROM "${tableName}"`);
      return parseInt(r.rows[0].mx) + 1;
    } else {
      const [r] = await conn.execute(`SELECT COALESCE(MAX(scan_id), 0) AS mx FROM \`${tableName}\``);
      return parseInt(r[0].mx) + 1;
    }
  } catch (e) {
    console.warn('[Serial] MAX query failed, start from 1:', e.message);
    return 1;
  }
}

function writeLog(data) {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
  const logFile = path.join(LOG_DIR, `transfer_${data.year}_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(logFile, JSON.stringify(data, null, 2));
  return logFile;
}

// =============================================
// Preview
// =============================================
router.post('/preview', async (req, res) => {
  const { startDate, endDate, year } = req.body;
  const config = loadConfig();

  if (!config.source || !config.source.host) {
    return res.json({ success: false, message: 'ยังไม่ได้บันทึกข้อมูลเชื่อมต่อต้นทาง' });
  }

  const yearCfg = YEAR_CONFIGS[year] || YEAR_CONFIGS[parseInt(year)];

  // ถ้ามี year config เฉพาะ (เช่น 2568) ใช้ query นั้น
  if (yearCfg) {
    let sourceConn, targetConn;
    try {
      sourceConn = await createSourceConn(config.source);

      // Count
      const [[countRow]] = await sourceConn.execute(yearCfg.countQuery, [startDate, endDate]);

      // Preview rows + src_size
      const [rows] = await sourceConn.execute(yearCfg.previewQuery, [startDate, endDate]);

      // เช็ค target opdscan — ดึง vn + ขนาด scan_image
      let targetMap = {};
      if (config.target && config.target.host && rows.length > 0) {
        try {
          targetConn = await createTargetConn(config.target);
          const isPg = config.target.dbType === 'postgresql';
          const vns = rows.map(r => r.vn).filter(Boolean);
          // targetMap: vn (string) → Set of hos_guid values
          // กรองด้วย vn และช่วงวันที่ด้วย เพื่อป้องกัน false "done" จากวันอื่น
          const buildMap = (tgtRows) => {
            tgtRows.forEach(r => {
              const key = String(r.vn);
              if (!targetMap[key]) targetMap[key] = new Set();
              targetMap[key].add(String(r.hos_guid));
            });
          };
          if (isPg) {
            const ph = vns.map((_, i) => `$${i + 3}`).join(',');
            const result = await targetConn.query(
              `SELECT vn::text AS vn, hos_guid::text AS hos_guid
               FROM opdscan
               WHERE scan_date_time::date BETWEEN $1 AND $2
                 AND vn::text IN (${ph})`,
              [startDate, endDate, ...vns.map(String)]
            );
            buildMap(result.rows);
          } else {
            const [tgtRows] = await targetConn.execute(
              `SELECT vn, hos_guid FROM \`opdscan\`
               WHERE DATE(scan_date_time) BETWEEN ? AND ?
                 AND vn IN (${vns.map(() => '?').join(',')})`,
              [startDate, endDate, ...vns]
            );
            buildMap(tgtRows);
          }
        } catch (e) {
          console.warn('[Preview] target check failed:', e.message);
        }
      }

      // กรอง: ซ่อนถ้า vn + hos_guid (doctype_id) ตรงกับ target แล้ว
      const filtered = rows.map(r => {
        const tgtSet = targetMap[String(r.vn)];
        let status;
        if (!tgtSet) {
          status = 'new';   // vn ยังไม่มีใน target
        } else if (tgtSet.has(String(r.hos_guid))) {
          status = 'done';  // vn + doctype ตรงกัน → ซ่อน
        } else {
          status = 'diff';  // vn มีอยู่ แต่ doctype ต่างกัน
        }
        return { ...r, status };
      }).filter(r => r.status !== 'done');

      res.json({ success: true, data: filtered, total: countRow.total, skipped: rows.length - filtered.length });
    } catch (err) {
      res.json({ success: false, message: err.message });
    } finally {
      if (sourceConn) await sourceConn.end().catch(() => {});
      if (targetConn)  await targetConn.end().catch(() => {});
    }
    return;
  }

  // Default: ใช้ custom query จาก config
  const customQuery = config.yearQueries && config.yearQueries[String(year)];
  if (!customQuery) {
    return res.json({ success: false, message: `ยังไม่มีการตั้งค่า Query สำหรับปี ${year}` });
  }
  res.json({ success: false, message: 'ปีนี้ยังไม่รองรับ — กรุณาติดต่อผู้พัฒนา' });
});

// =============================================
// Start Transfer
// =============================================
router.post('/start', async (req, res) => {
  const { startDate, endDate, year, selectedKeys } = req.body;
  const config = loadConfig();

  if (!config.source || !config.source.host) {
    return res.json({ success: false, message: 'ยังไม่ได้บันทึกข้อมูลเชื่อมต่อต้นทาง' });
  }
  if (!config.target || !config.target.host) {
    return res.json({ success: false, message: 'ยังไม่ได้บันทึกข้อมูลเชื่อมต่อปลายทาง' });
  }

  const yearCfg = YEAR_CONFIGS[year] || YEAR_CONFIGS[parseInt(year)];
  if (!yearCfg) {
    return res.json({ success: false, message: `ยังไม่รองรับการโอนข้อมูลปี ${year}` });
  }

  const jobId = crypto.randomUUID();
  const progressStore = req.app.get('progressStore');
  progressStore.set(jobId, {
    jobId, status: 'running', progress: 0,
    total: 0, success: 0, failed: 0,
    currentRecord: 'กำลังเตรียมข้อมูล...', errors: [], startTime: Date.now()
  });

  res.json({ success: true, jobId });

  // Async transfer
  (async () => {
    let sourceConn, targetConn;
    const errors = [];

    try {
      sourceConn = await createSourceConn(config.source);
      targetConn = await createTargetConn(config.target);
      const isPg = config.target.dbType === 'postgresql';
      const targetTable = yearCfg.targetTable;

      // Fetch source records (กรองเฉพาะ vn|hos_guid ที่เลือก)
      let fetchQuery = yearCfg.sourceQuery;
      let fetchParams = [startDate, endDate];
      if (selectedKeys && selectedKeys.length > 0) {
        // parse "vn|hos_guid" pairs
        const pairs = selectedKeys.map(k => k.split('|'));
        const placeholders = pairs.map(() => '(? AND ?)').join(' OR ');
        fetchQuery += ` AND (${pairs.map(() => `(tbo.vn = ? AND tbd.doctype_id = ?)`).join(' OR ')})`;
        fetchParams = [startDate, endDate, ...pairs.flat()];
      }
      const [rows] = await sourceConn.execute(fetchQuery, fetchParams);
      const total = rows.length;
      progressStore.set(jobId, { ...progressStore.get(jobId), total });

      if (total === 0) {
        progressStore.set(jobId, { ...progressStore.get(jobId), status: 'completed', progress: 100, currentRecord: 'ไม่พบข้อมูลในช่วงวันที่ที่เลือก' });
        return;
      }

      // ดึง MAX(scan_id) เริ่มต้น แล้ว +1 ทุก record
      let serialCounter = await resolveSerialMode(targetConn, targetTable, isPg);
      console.log(`[Transfer] เริ่ม scan_id จาก: ${serialCounter}`);

      let successCount = 0, failedCount = 0;

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const hn = row.hn;

        progressStore.set(jobId, {
          ...progressStore.get(jobId),
          currentRecord: `กำลังประมวลผล HN: ${hn} (${i + 1}/${total})`
        });

        try {
          // แปลง PDF → JPEG
          const pdfData = row[yearCfg.pdfField];
          if (!pdfData || pdfData.length < 5) throw new Error('ไม่มีข้อมูล PDF');

          const pdfBuffer = Buffer.isBuffer(pdfData) ? pdfData : Buffer.from(pdfData);
          const jpegBuffer = await convertPdfToJpeg(pdfBuffer);

          // scan_id = counter ปัจจุบัน แล้ว +1
          const scanId = serialCounter++;
          if (i < 3) console.log(`[Transfer] i=${i} hn=${hn} scanId=${scanId}`);

          // ส่ง scan_date_time เป็น string ตรงๆ ป้องกัน timezone shift
          const scanDateTime = row.scan_date_time || new Date().toISOString().slice(0, 19).replace('T', ' ');

          // INSERT ลง opdscan
          let rowInserted = false;
          if (isPg) {
            const result = await targetConn.query(
              `INSERT INTO "${targetTable}"
                (scan_id, hn, vn, scan_date_time, pageno, scan_image, image_type, hos_guid, officer, check_right, scan_type_id)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
               ON CONFLICT (scan_id) DO UPDATE SET
                 hn = EXCLUDED.hn, vn = EXCLUDED.vn,
                 scan_date_time = EXCLUDED.scan_date_time,
                 scan_image = EXCLUDED.scan_image,
                 image_type = EXCLUDED.image_type,
                 hos_guid = EXCLUDED.hos_guid,
                 officer = EXCLUDED.officer,
                 check_right = EXCLUDED.check_right,
                 scan_type_id = EXCLUDED.scan_type_id`,
              [scanId, row.hn, row.vn, scanDateTime, row.pageno, jpegBuffer,
               row.image_type, row.hos_guid, row.officer, row.check_right, row.scan_type_id]
            );
            rowInserted = result.rowCount > 0;
          } else {
            const [result] = await targetConn.execute(
              `INSERT INTO \`${targetTable}\`
                (scan_id, hn, vn, scan_date_time, pageno, scan_image, image_type, hos_guid, officer, check_right, scan_type_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON DUPLICATE KEY UPDATE
                 hn = VALUES(hn), vn = VALUES(vn),
                 scan_date_time = VALUES(scan_date_time),
                 scan_image = VALUES(scan_image),
                 image_type = VALUES(image_type),
                 hos_guid = VALUES(hos_guid),
                 officer = VALUES(officer),
                 check_right = VALUES(check_right),
                 scan_type_id = VALUES(scan_type_id)`,
              [scanId, row.hn, row.vn, scanDateTime, row.pageno, jpegBuffer,
               row.image_type, row.hos_guid, row.officer, row.check_right, row.scan_type_id]
            );
            rowInserted = result.affectedRows > 0;
          }

          if (rowInserted) {
            successCount++;
          } else {
            failedCount++;
            errors.push({ id: hn, error: `INSERT ไม่สำเร็จ scan_id=${scanId} (affectedRows=0)` });
          }
        } catch (rowErr) {
          failedCount++;
          errors.push({ id: hn, error: rowErr.message });
        }

        progressStore.set(jobId, {
          ...progressStore.get(jobId),
          progress: Math.round(((i + 1) / total) * 100),
          success: successCount,
          failed: failedCount,
          errors: errors
        });
      }

      const logFile = writeLog({ year, startDate, endDate, total, successCount, failedCount, errors, completedAt: new Date().toISOString() });

      progressStore.set(jobId, {
        ...progressStore.get(jobId),
        status: 'completed', progress: 100,
        success: successCount, failed: failedCount,
        currentRecord: `เสร็จสิ้น: สำเร็จ ${successCount} รายการ, ล้มเหลว ${failedCount} รายการ`,
        logFile
      });

    } catch (err) {
      progressStore.set(jobId, {
        ...progressStore.get(jobId),
        status: 'error',
        message: `เกิดข้อผิดพลาด: ${err.message}`
      });
    } finally {
      if (sourceConn) await sourceConn.end().catch(() => {});
      if (targetConn) await targetConn.end().catch(() => {});
    }
  })();
});

// Query records transferred to OTHER dates (scan_date_time ≠ selected date)
router.post('/other-dates', async (req, res) => {
  const { startDate, endDate, year } = req.body;
  const config = loadConfig();

  if (!config.source || !config.source.host) return res.json({ success: false, message: 'ยังไม่ได้บันทึกข้อมูลเชื่อมต่อต้นทาง' });
  if (!config.target || !config.target.host) return res.json({ success: false, message: 'ยังไม่ได้บันทึกข้อมูลเชื่อมต่อปลายทาง' });

  const configKey = String(year);
  const yearCfg = YEAR_CONFIGS[configKey] || YEAR_CONFIGS[parseInt(configKey)];
  if (!yearCfg) return res.json({ success: false, message: `ไม่พบ config สำหรับปี ${year}` });

  let sourceConn, targetConn;
  try {
    // ดึง vn ทั้งหมดจาก source ตามวันที่เลือก
    sourceConn = await createSourceConn(config.source);
    const [srcRows] = await sourceConn.execute(yearCfg.countQuery.replace('SELECT COUNT(*) AS total', 'SELECT tbo.vn'), [startDate, endDate]);
    const vns = srcRows.map(r => r.vn).filter(Boolean);

    if (vns.length === 0) return res.json({ success: true, data: [], total: 0 });

    // หา record ใน opdscan ที่มี vn เหล่านั้น แต่ scan_date_time อยู่วันอื่น
    targetConn = await createTargetConn(config.target);
    const isPg = config.target.dbType === 'postgresql';

    let rows;
    if (isPg) {
      const ph = vns.map((_, i) => `$${i + 3}`).join(',');
      const result = await targetConn.query(
        `SELECT scan_id, hn, vn, scan_date_time, pageno, image_type, hos_guid, officer,
                COALESCE(LENGTH(scan_image), 0) AS img_size
         FROM opdscan
         WHERE (scan_date_time::date < $1 OR scan_date_time::date > $2)
           AND vn::text IN (${ph})
         ORDER BY scan_date_time`,
        [startDate, endDate, ...vns.map(String)]
      );
      rows = result.rows;
    } else {
      const [r] = await targetConn.execute(
        `SELECT scan_id, hn, vn, scan_date_time, pageno, image_type, hos_guid, officer,
                COALESCE(LENGTH(scan_image), 0) AS img_size
         FROM \`opdscan\`
         WHERE (DATE(scan_date_time) < ? OR DATE(scan_date_time) > ?)
           AND vn IN (${vns.map(() => '?').join(',')})
         ORDER BY scan_date_time`,
        [startDate, endDate, ...vns]
      );
      rows = r;
    }

    res.json({ success: true, data: rows, total: rows.length, sourceTotal: vns.length });
  } catch (err) {
    res.json({ success: false, message: err.message });
  } finally {
    if (sourceConn) await sourceConn.end().catch(() => {});
    if (targetConn) await targetConn.end().catch(() => {});
  }
});

// Query transferred records from target DB
router.post('/transferred', async (req, res) => {
  const { startDate, endDate } = req.body;
  const config = loadConfig();

  if (!config.target || !config.target.host) {
    return res.json({ success: false, message: 'ยังไม่ได้บันทึกข้อมูลเชื่อมต่อปลายทาง' });
  }

  let conn;
  try {
    conn = await createTargetConn(config.target);
    const isPg = config.target.dbType === 'postgresql';

    let rows, countRow;
    if (isPg) {
      const result = await conn.query(
        `SELECT scan_id, hn, vn, scan_date_time, pageno,
                image_type, hos_guid, officer, scan_type_id,
                COALESCE(LENGTH(scan_image), 0) AS img_size
         FROM opdscan
         WHERE scan_date_time::date BETWEEN $1 AND $2
         ORDER BY vn`,
        [startDate, endDate]
      );
      rows = result.rows;
      const countRes = await conn.query(
        `SELECT COUNT(*) AS total FROM opdscan WHERE scan_date_time::date BETWEEN $1 AND $2`,
        [startDate, endDate]
      );
      countRow = countRes.rows[0];
    } else {
      const [r] = await conn.execute(
        `SELECT scan_id, hn, vn, scan_date_time, pageno,
                image_type, hos_guid, officer, scan_type_id,
                COALESCE(LENGTH(scan_image), 0) AS img_size
         FROM \`opdscan\`
         WHERE DATE(scan_date_time) BETWEEN ? AND ?
         ORDER BY vn`,
        [startDate, endDate]
      );
      rows = r;
      const [[cr]] = await conn.execute(
        `SELECT COUNT(*) AS total FROM \`opdscan\` WHERE DATE(scan_date_time) BETWEEN ? AND ?`,
        [startDate, endDate]
      );
      countRow = cr;
    }

    res.json({ success: true, data: rows, total: countRow.total });
  } catch (err) {
    res.json({ success: false, message: err.message });
  } finally {
    if (conn) await conn.end().catch(() => {});
  }
});

// Get job status (polling fallback)
router.get('/status/:jobId', (req, res) => {
  const progressStore = req.app.get('progressStore');
  const progress = progressStore.get(req.params.jobId);
  if (!progress) return res.json({ success: false, message: 'ไม่พบ Job ID' });
  res.json({ success: true, ...progress });
});

// Get year config info (for frontend display)
router.get('/year-config/:year', (req, res) => {
  const cfg = YEAR_CONFIGS[req.params.year] || YEAR_CONFIGS[parseInt(req.params.year)];
  if (!cfg) return res.json({ success: false });
  res.json({ success: true, label: cfg.label, sourceQuery: cfg.sourceQuery, targetTable: cfg.targetTable });
});

module.exports = router;
