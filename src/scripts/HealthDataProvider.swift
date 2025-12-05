import HealthKit
import Foundation

class HealthDataProvider: NSObject {
    let healthStore = HKHealthStore()
    let heartRateType = HKObjectType.quantityType(forIdentifier: .heartRate)! 
    let useMockData: Bool
    
    // 初始化时设置是否使用模拟数据
    init(useMockData: Bool = false) {
        self.useMockData = useMockData
        super.init()
    }
    
    func requestAuthorization(completion: @escaping (Bool) -> Void) {
        // 如果使用模拟数据，直接授权成功
        if useMockData {
            completion(true)
            return
        }
        
        // 检查HealthKit是否可用
        guard HKHealthStore.isHealthDataAvailable() else {
            print("HealthKit is not available on this device")
            completion(false)
            return
        }
        
        let typesToShare: Set = [HKObjectType.workoutType()]
        let typesToRead: Set = [heartRateType]
        
        healthStore.requestAuthorization(toShare: typesToShare, read: typesToRead) { (success, error) in
            if let error = error {
                print("Authorization error: \(error.localizedDescription)")
                completion(false)
            } else {
                completion(success)
            }
        }
    }
    
    func getLatestHeartRate(completion: @escaping (Double?) -> Void) {
        // 如果使用模拟数据，生成随机心率
        if useMockData {
            // 生成60-100之间的随机心率值，模拟真实心率范围
            let mockHeartRate = Double(60 + Int.random(in: 0...40))
            print("Using mock heart rate data: \(mockHeartRate)")
            completion(mockHeartRate)
            return
        }
        
        // 检查HealthKit是否可用
        guard HKHealthStore.isHealthDataAvailable() else {
            print("HealthKit is not available")
            completion(nil)
            return
        }
        
        let query = HKSampleQuery(sampleType: heartRateType, predicate: nil, limit: 1, sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)]) { (query, samples, error) in
            if let error = error {
                print("Error fetching heart rate: \(error.localizedDescription)")
                completion(nil)
                return
            }
            
            if let samples = samples as? [HKQuantitySample], let mostRecentSample = samples.first {
                let heartRateUnit = HKUnit(from: "count/min")
                let heartRate = mostRecentSample.quantity.doubleValue(for: heartRateUnit)
                completion(heartRate)
            } else {
                print("No heart rate samples found")
                completion(nil)
            }
        }
        
        healthStore.execute(query)
    }
}

// 主执行代码
func main() {
    // 检查命令行参数，判断是否使用模拟数据
    let arguments = CommandLine.arguments
    let useMockData = arguments.contains("--mock") || arguments.contains("-m")
    
    print("Running with useMockData: \(useMockData)")
    
    if #available(OSX 10.13, *) {
        let healthProvider = HealthDataProvider(useMockData: useMockData)
        
        healthProvider.requestAuthorization { success in
            if success {
                healthProvider.getLatestHeartRate { heartRate in
                    if let heartRate = heartRate {
                        print("{\"heartRate\": \(heartRate)}")
                    } else {
                        print("{\"error\": \"No heart rate data available\"}")
                    }
                    // 退出进程
                    exit(0)
                }
            } else {
                if useMockData {
                    // 即使授权失败，如果是模拟模式也返回模拟数据
                    let mockHeartRate = Double(60 + Int.random(in: 0...40))
                    print("{\"heartRate\": \(mockHeartRate), \"source\": \"mock\"}")
                    exit(0)
                } else {
                    print("{\"error\": \"Authorization failed\"}")
                    exit(1)
                }
            }
            
            // 保持脚本运行直到获得结果或超时
            RunLoop.main.run(until: Date(timeIntervalSinceNow: 10))
        }
    } else {
        if useMockData {
            // 即使系统版本不支持，如果是模拟模式也返回模拟数据
            let mockHeartRate = Double(60 + Int.random(in: 0...40))
            print("{\"heartRate\": \(mockHeartRate), \"source\": \"mock\"}")
            exit(0)
        } else {
            print("{\"error\": \"HealthKit requires macOS 10.13 or later\"}")
            exit(1)
        }
    }
}

// 执行主函数
main()