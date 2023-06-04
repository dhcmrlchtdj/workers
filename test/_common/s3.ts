import * as S from "../../src/_common/http/request.js"
import { signAWS4Header, signAWS4Query } from "../../src/_common/service/s3.js"

describe("S3", () => {
	test("signAWS4Header | Get Object", async () => {
		jest.useFakeTimers()
		jest.setSystemTime(new Date("2013-05-24T00:00:00.000Z"))

		const r = await signAWS4Header(
			S.build(
				S.get("https://examplebucket.s3.amazonaws.com/test.txt"),
				S.header("host", "examplebucket.s3.amazonaws.com"),
				S.header("range", "bytes=0-9"),
			),
			{
				region: "us-east-1",
				accessKeyId: "AKIAIOSFODNN7EXAMPLE",
				secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
			},
		)

		expect(r.headers.get("authorization")).toBe(
			[
				"AWS4-HMAC-SHA256 ",
				"Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request,",
				"SignedHeaders=host;range;x-amz-content-sha256;x-amz-date,",
				"Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41",
			].join(""),
		)
	})

	test("signAWS4Header | Put Object", async () => {
		jest.useFakeTimers()
		jest.setSystemTime(new Date("2013-05-24T00:00:00.000Z"))

		const r = await signAWS4Header(
			S.build(
				S.put("https://examplebucket.s3.amazonaws.com/test$file.text"),
				S.header("date", "Fri, 24 May 2013 00:00:00 GMT"),
				S.header("host", "examplebucket.s3.amazonaws.com"),
				S.header("x-amz-storage-class", "REDUCED_REDUNDANCY"),
				S.body("Welcome to Amazon S3."),
			),
			{
				region: "us-east-1",
				accessKeyId: "AKIAIOSFODNN7EXAMPLE",
				secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
			},
		)

		expect(r.headers.get("authorization")).toBe(
			[
				"AWS4-HMAC-SHA256 ",
				"Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request,",
				"SignedHeaders=date;host;x-amz-content-sha256;x-amz-date;x-amz-storage-class,",
				"Signature=98ad721746da40c64f1a55b78f14c238d841ea1380cd77a1b5971af0ece108bd",
			].join(""),
		)
	})

	test("signAWS4Header | Get Bucket Lifecycle", async () => {
		jest.useFakeTimers()
		jest.setSystemTime(new Date("2013-05-24T00:00:00.000Z"))

		const r = await signAWS4Header(
			S.build(
				S.get("https://examplebucket.s3.amazonaws.com?lifecycle"),
				S.header("host", "examplebucket.s3.amazonaws.com"),
			),
			{
				region: "us-east-1",
				accessKeyId: "AKIAIOSFODNN7EXAMPLE",
				secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
			},
		)

		expect(r.headers.get("authorization")).toBe(
			[
				"AWS4-HMAC-SHA256 ",
				"Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request,",
				"SignedHeaders=host;x-amz-content-sha256;x-amz-date,",
				"Signature=fea454ca298b7da1c68078a5d1bdbfbbe0d65c699e0f91ac7a200a0136783543",
			].join(""),
		)
	})

	test("signAWS4Header | List Objects", async () => {
		jest.useFakeTimers()
		jest.setSystemTime(new Date("2013-05-24T00:00:00.000Z"))

		const r = await signAWS4Header(
			S.build(
				S.get(
					"https://examplebucket.s3.amazonaws.com?max-keys=2&prefix=J",
				),
				S.header("host", "examplebucket.s3.amazonaws.com"),
			),
			{
				region: "us-east-1",
				accessKeyId: "AKIAIOSFODNN7EXAMPLE",
				secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
			},
		)

		expect(r.headers.get("authorization")).toBe(
			[
				"AWS4-HMAC-SHA256 ",
				"Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request,",
				"SignedHeaders=host;x-amz-content-sha256;x-amz-date,",
				"Signature=34b48302e7b5fa45bde8084f4b7868a86f0a534bc59db6670ed5711ef69dc6f7",
			].join(""),
		)
	})

	test("signAWS4Query", async () => {
		jest.useFakeTimers()
		jest.setSystemTime(new Date("2013-05-24T00:00:00.000Z"))

		const r = await signAWS4Query(
			S.build(
				S.get("https://examplebucket.s3.amazonaws.com/test.txt"),
				S.header("host", "examplebucket.s3.amazonaws.com"),
			),
			{
				region: "us-east-1",
				accessKeyId: "AKIAIOSFODNN7EXAMPLE",
				secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
			},
		)

		expect(r.url).toBe(
			[
				"https://examplebucket.s3.amazonaws.com/test.txt",
				"?X-Amz-Algorithm=AWS4-HMAC-SHA256",
				"&X-Amz-Date=20130524T000000Z",
				"&X-Amz-Expires=86400",
				"&X-Amz-SignedHeaders=host",
				"&X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20130524%2Fus-east-1%2Fs3%2Faws4_request",
				"&X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404",
			].join(""),
		)
	})
})
