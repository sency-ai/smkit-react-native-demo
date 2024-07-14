# Android Setup

In order to integrate SMKitUI you need to import the smkitui dependency
Add on project level `build.gradle`:
 ```groovy
allprojects {
    maven {
        url ${artifactory_contentUrl}
    }
}
```
#### FBJNI

Both React Native and SencyMotion use **fbjni**. For example, the versions for SMKitUI that are used for
development are:

React Native (<= 0.64) uses fbjni **0.0.2**
SMKitUI uses fbjni **0.2.2**.
Therefore we need to exclude fbjbi on app level `build.gradle`:
 ```groovy
dependencies {
  implementation("com.sency.smkitui:smkitui:${SMKitUI_Version}") {
      exclude group: 'com.facebook.fbjni', module: 'fbjni-java-only'
  }
}
```

Inside `gradle.properties` insert thoose global properties:
```groovy
SMKitUI_Version = 0.1.4
artifactory_contentUrl = "https://artifacts.sency.ai/artifactory/release"
```
