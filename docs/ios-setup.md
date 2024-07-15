# iOS Setup

1. Update *Podfile* in `iOS` folder:
```
[1] add the source to the top of your Podfile.
source 'https://bitbucket.org/sencyai/ios_sdks_release.git'
source 'https://github.com/CocoaPods/Specs.git'

[2] add use_frameworks! commend to your target
target 'YOUR_TARGET' do
  use_frameworks!
  
[3] At the end of your code please add 

  post_install do |installer|
   react_native_post_install(
     installer,
     :mac_catalyst_enabled => false
   )
   installer.pods_project.targets.each do |target|
     target.build_configurations.each do |config|
       config.build_settings['BUILD_LIBRARY_FOR_DISTRIBUTION'] = 'YES'
       config.build_settings['EXCLUDED_ARCHS[sdk=iphonesimulator*]'] = 'arm64'
     end
   end
   __apply_Xcode_12_5_M1_post_install_workaround(installer)
 end
end

```

2. Run `NO_FLIPPER=1 pod install` to install the necessary pods.
3. Add camera permission request to `Info.plist`
```Xml
<key>NSCameraUsageDescription</key>
<string>Camera access is needed</string>
```

----- 
## Known issues
1. Dynamic/Static linking issues due to `use_frameworks`:
If you're unable to use use_frameworks you should add the following code to your Podfile:

```ruby
# [1] Add the dynamic_frameworks array that will hold all of the dynamic frameworks names
dynamic_frameworks = ['SMKitUI', 'SMKit', 'SMBase', 'SwiftyJSON', 'SMBaseUI']

# [2] Add this pre_install function
pre_install do |installer|
  installer.pod_targets.each do |pod|
    if dynamic_frameworks.include?(pod.name)
      def pod.build_type
        Pod::BuildType.dynamic_framework
      end
    end
  end
end

# [3] Add this post_install function
post_install do |installer|
react_native_post_install(installer, config[:reactNativePath], :mac_catalyst_enabled => false)
   installer.pods_project.targets.each do |target|
    if dynamic_frameworks.include?(target.name)
        target.build_configurations.each do |config|
          config.build_settings['BUILD_LIBRARY_FOR_DISTRIBUTION'] = 'YES'
          config.build_settings['EXCLUDED_ARCHS[sdk=iphonesimulator*]'] = 'arm64'
        end
      end
    end
  end
end
```

Now you can run pod install.
