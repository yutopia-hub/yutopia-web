package com.yutopia.support;

import javax.sql.DataSource;

import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;

@TestConfiguration(proxyBeanMethods = false)
public class TestDatabaseSafetyConfiguration {
    @Bean
    static BeanPostProcessor testDatabaseGuard() {
        return new BeanPostProcessor() {
            @Override
            public Object postProcessAfterInitialization(Object bean, String name) {
                if (bean instanceof DataSource dataSource) {
                    try (var connection = dataSource.getConnection()) {
                        if (!"yutopia_test".equals(connection.getCatalog())) {
                            throw new IllegalStateException("Tests require the separate yutopia_test database.");
                        }
                    } catch (java.sql.SQLException error) {
                        throw new IllegalStateException("Cannot connect to yutopia_test; check test-only connection settings.");
                    }
                }
                return bean;
            }
        };
    }
}
